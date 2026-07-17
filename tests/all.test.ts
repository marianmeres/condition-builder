import { assertEquals, assertThrows } from "@std/assert";
import { Condition } from "../src/condition.ts";
import {
	Expression,
	type ExpressionContext,
	OPERATOR,
	type Validator,
} from "../src/expression.ts";
import { pgParameterized, pgRenderers } from "../src/presets.ts";

Deno.test("expression", () => {
	const e = new Expression("foo", OPERATOR.eq, "bar");
	assertEquals(e.toString(), "foo=bar");

	assertEquals(e.toJSON(), {
		key: "foo",
		operator: "eq",
		value: "bar",
	});
});

Deno.test("expression custom operator", () => {
	const e = new Expression("foo", "==", "bar");
	assertEquals(e.toString(), "foo==bar");
});

Deno.test("condition", () => {
	const c = new Condition();

	c.and("a", OPERATOR.eq, "b");
	assertEquals(c.toString(), "a=b");

	c.or("c", OPERATOR.neq, "d");
	assertEquals(c.toString(), "a=b or c!=d");

	c.or(
		new Condition()
			.and("e", OPERATOR.lt, "f")
			.and("g", OPERATOR.eq, "h")
			.or(
				new Condition()
					.and("i", OPERATOR.match, "j")
					.and("k", OPERATOR.nmatch, "l"),
			),
	);

	const expected = "a=b or c!=d or (e<f and g=h or (i~*j and k!~*l))";
	assertEquals(c.toString(), expected);

	// dump & restore
	const c2 = Condition.restore(c.dump());
	assertEquals(c.toJSON(), c2.toJSON());
	assertEquals(c2.toString(), expected);
});

Deno.test("validator and custom renderers", () => {
	const c = new Condition({
		validate: (ctx: ExpressionContext) => {
			const { key } = ctx;
			const keyWhitelist = ["foo"];
			if (!keyWhitelist.includes(key.toLowerCase())) {
				throw new TypeError(`Key '${key}' not allowed`);
			}
		},
		renderKey: (ctx: ExpressionContext) => ctx.key.toLowerCase(),
		renderValue: (ctx: ExpressionContext) => ctx.value.toUpperCase(),
		renderOperator: (ctx: ExpressionContext) => `:${ctx.operator}:`,
	});
	c.and("fOo", OPERATOR.eq, "bar");
	assertEquals(c.toString(), "foo:eq:BAR");

	// this must throw
	assertThrows(() => c.and("baz", OPERATOR.neq, "bat"));
});

Deno.test("custom renderExpression renderer", () => {
	const c = new Condition({
		renderExpression({ key, operator, value }) {
			if (key == "1" && ["=", OPERATOR.eq].includes(operator) && value == "1") {
				return "true";
			}
			// return undefined;
		},
	});
	c.and("1", OPERATOR.eq, "1").and("foo", "<", "bar");

	assertEquals(c.toString(), "true and foo<bar");
});

Deno.test("restore with options", () => {
	const c = new Condition();
	c.and("a", OPERATOR.eq, "b");

	const validate: Validator = (c) => {
		if (c.key === "a") throw new TypeError();
	};

	assertThrows(() => Condition.restore(c.dump(), { validate }));
});

Deno.test("a=b and (c=d or e=f)", () => {
	const c = new Condition();

	c.and("a", OPERATOR.eq, "b");
	c.and(new Condition().and("c", OPERATOR.eq, "d").or("e", "=", "f"));

	const expected = "a=b and (c=d or e=f)";
	assertEquals(c.toString(), expected);

	const c2 = Condition.restore(c.dump());
	assertEquals(c.toJSON(), c2.toJSON());
	assertEquals(c2.toString(), expected);
});

Deno.test("(a=b) and (c=d)", () => {
	const c = new Condition();

	c.and(new Condition().and("a", OPERATOR.eq, "b")).and(
		new Condition().and("c", OPERATOR.eq, "d"),
	);

	const expected = "(a=b) and (c=d)";
	assertEquals(c.toString(), expected);

	const c2 = Condition.restore(c.dump());
	assertEquals(c.toJSON(), c2.toJSON());
	assertEquals(c2.toString(), expected);
});

Deno.test("a=b or c=d or e=f", () => {
	const c = new Condition();

	c.or("a", OPERATOR.eq, "b")
		.or("c", OPERATOR.eq, "d")
		.or("e", OPERATOR.eq, "f");

	const expected = "a=b or c=d or e=f";
	assertEquals(c.toString(), expected);

	const c2 = Condition.restore(c.dump());
	assertEquals(c.toJSON(), c2.toJSON());
	assertEquals(c2.toString(), expected);
});

Deno.test("precedence: mixed and/or auto-parenthesizes", () => {
	// API calls are left-associative:
	// (((a=b) and c=d) or e=f) and g=h
	// → render must parenthesize the OR subgroup because the trailing AND
	// would otherwise bind tighter than OR in SQL.
	const c = new Condition();

	c.and("a", OPERATOR.eq, "b")
		.and("c", OPERATOR.eq, "d")
		.or("e", OPERATOR.eq, "f")
		.and("g", OPERATOR.eq, "h");

	const expected = "(a=b and c=d or e=f) and g=h";
	assertEquals(c.toString(), expected);

	const c2 = Condition.restore(c.dump());
	assertEquals(c.toJSON(), c2.toJSON());
	assertEquals(c2.toString(), expected);
});

Deno.test("precedence: OR followed by AND wraps the OR group", () => {
	const c = new Condition()
		.and("a", OPERATOR.eq, "1")
		.or("b", OPERATOR.eq, "2")
		.and("c", OPERATOR.eq, "3");
	assertEquals(c.toString(), "(a=1 or b=2) and c=3");
});

Deno.test("empty is ignored in string output", () => {
	const c = new Condition();

	c.and(new Condition().and(new Condition()).and(new Condition()));

	assertEquals(c.toString(), "");
});

Deno.test("isEmpty", () => {
	assertEquals(new Condition().isEmpty(), true);

	const nested = new Condition().and(new Condition()).and(new Condition());
	assertEquals(nested.isEmpty(), true);

	const withExpr = new Condition().and("a", OPERATOR.eq, "b");
	assertEquals(withExpr.isEmpty(), false);

	const deepWithExpr = new Condition().and(
		new Condition().and(new Condition().and("x", OPERATOR.eq, "y")),
	);
	assertEquals(deepWithExpr.isEmpty(), false);
});

Deno.test("not", () => {
	const c = new Condition();

	c.and("a", OPERATOR.eq, "b")
		.andNot("c", OPERATOR.eq, "d")
		.orNot(
			new Condition().and("e", OPERATOR.eq, "f").andNot("g", OPERATOR.eq, "h"),
		);

	assertEquals(c.toString(), "a=b and not c=d or not (e=f and not g=h)");
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression tests for the 1.10 audit fixes.
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("sub-condition options are not clobbered when attached", () => {
	const subCalls: string[] = [];
	const mainCalls: string[] = [];

	const sub = new Condition({
		validate: (ctx) => subCalls.push(ctx.key),
	});
	sub.and("x", OPERATOR.eq, "1");

	const main = new Condition({
		validate: (ctx) => mainCalls.push(ctx.key),
	});
	main.and("y", OPERATOR.eq, "2").and(sub);

	// After attaching, sub.options must be untouched.
	sub.and("z", OPERATOR.eq, "3");

	assertEquals(subCalls, ["x", "z"]);
	assertEquals(mainCalls, ["y"]);
});

Deno.test("explicit undefined in toString options does not erase instance renderers", () => {
	const c = new Condition({
		renderValue: ({ value }) => `'${value}'`,
	});
	c.and("a", OPERATOR.eq, "b");

	assertEquals(c.toString(), "a='b'");
	// explicit `undefined` must NOT clobber the configured renderer
	assertEquals(c.toString({ renderValue: undefined }), "a='b'");
});

Deno.test("renderExpression returning an empty string is honored", () => {
	const c = new Condition({
		renderExpression: () => "",
	});
	c.and("a", OPERATOR.eq, "b");
	assertEquals(c.toString(), "");
});

Deno.test("renderExpression returning false/null/undefined falls back", () => {
	const c = new Condition({
		renderExpression: ({ key }) => (key === "skip" ? false : undefined),
	});
	c.and("foo", OPERATOR.eq, "bar").and("skip", OPERATOR.eq, "x");
	assertEquals(c.toString(), "foo=bar and skip=x");
});

Deno.test("array values render as parenthesized list for in/nin", () => {
	const c = new Condition()
		.and("id", OPERATOR.in, [1, 2, 3])
		.andNot("tag", OPERATOR.nin, ["a", "b"]);
	assertEquals(c.toString(), "id in (1,2,3) and not tag not in (a,b)");
});

Deno.test("array list-operator values pass each element through renderValue", () => {
	const c = new Condition({
		renderValue: ({ value }) => `'${value}'`,
	});
	c.and("id", OPERATOR.in, [1, 2, 3]);
	assertEquals(c.toString(), "id in ('1','2','3')");
});

Deno.test("non-list operators still render arrays as a single rendered value", () => {
	// Regression guard: we only special-case `in`/`nin`, not every operator.
	const c = new Condition().and("x", OPERATOR.eq, [1, 2]);
	assertEquals(c.toString(), "x=1,2");
});

Deno.test("deeply nested dump/restore round-trip", () => {
	const c = new Condition()
		.and("a", OPERATOR.eq, "1")
		.or(
			new Condition()
				.and("b", OPERATOR.eq, "2")
				.and(
					new Condition()
						.and("c", OPERATOR.eq, "3")
						.or(new Condition().and("d", OPERATOR.eq, "4")),
				),
		);

	const expected = c.toString();
	const restored = Condition.restore(c.dump());
	assertEquals(restored.toJSON(), c.toJSON());
	assertEquals(restored.toString(), expected);
});

Deno.test("pg preset renders safely-escaped SQL", () => {
	const c = new Condition()
		.and('fo"o', OPERATOR.eq, "ba'r")
		.and("id", OPERATOR.in, [1, 2, 3])
		.or("active", OPERATOR.is, null);

	assertEquals(
		c.toString(pgRenderers),
		`"fo""o"='ba''r' and "id" in (1,2,3) or "active" is null`,
	);
});

Deno.test("pgParameterized collects params and emits $n placeholders", () => {
	const { options, params } = pgParameterized();
	const c = new Condition()
		.and("id", OPERATOR.in, [1, 2, 3])
		.and("name", OPERATOR.eq, "'; drop table users; --");

	const sql = c.toString(options);
	assertEquals(sql, `"id" in ($1,$2,$3) and "name"=$4`);
	assertEquals(params, [1, 2, 3, "'; drop table users; --"]);
});

Deno.test("pgParameterized respects custom startIndex", () => {
	const { options, params } = pgParameterized(10);
	const c = new Condition().and("a", OPERATOR.eq, "x").or("b", OPERATOR.eq, "y");
	assertEquals(c.toString(options), `"a"=$10 or "b"=$11`);
	assertEquals(params, ["x", "y"]);
});

// --- restore() input validation (silent-corruption hardening) ------------

Deno.test("restore throws on array-wrapped expression (README-bug shape)", () => {
	// the shape once shown (incorrectly) in condition-parser's README — used
	// to restore "successfully" and render `undefinedundefinedundefined`s
	const dump = [
		{
			expression: { key: "a", operator: "eq", value: "b" },
			operator: "and",
		},
		{
			condition: [
				{
					expression: [{ key: "c", operator: "eq", value: "d" }],
					operator: "or",
				},
				{
					expression: [{ key: "e", operator: "eq", value: "f" }],
					operator: "or",
				},
			],
			operator: "and",
		},
	];
	assertThrows(
		() => Condition.restore(dump as any),
		TypeError,
		"Invalid 'expression'",
	);
	// same via JSON string input
	assertThrows(
		() => Condition.restore(JSON.stringify(dump)),
		TypeError,
		"Invalid 'expression'",
	);
});

Deno.test("restore throws on non-object expression", () => {
	for (const expression of ["a:b", 123, true]) {
		assertThrows(
			() => Condition.restore([{ operator: "and", expression }] as any),
			TypeError,
			"Invalid 'expression'",
		);
	}
});

Deno.test("restore throws on expression with missing or non-string key", () => {
	// missing (or typo-ed) `key`
	assertThrows(
		() =>
			Condition.restore([
				{ operator: "and", expression: { operator: "eq", value: "b" } },
			] as any),
		TypeError,
		"Invalid 'expression'",
	);
	// non-string `key`
	assertThrows(
		() =>
			Condition.restore([
				{ operator: "and", expression: { key: 123, operator: "eq", value: "b" } },
			] as any),
		TypeError,
		"Invalid 'expression'",
	);
});

Deno.test("restore throws on non-array dump", () => {
	assertThrows(() => Condition.restore("{}"), TypeError, "Invalid dump");
	assertThrows(() => Condition.restore({} as any), TypeError, "Invalid dump");
	assertThrows(() => Condition.restore("null"), TypeError, "Invalid dump");
});

Deno.test("restore throws on invalid join operator (where used)", () => {
	assertThrows(
		() =>
			Condition.restore([
				{
					operator: "xor",
					expression: { key: "a", operator: "eq", value: "b" },
				},
			] as any),
		TypeError,
		'Invalid join operator "xor"',
	);
});

Deno.test("restore tolerates invalid operator on the LAST entry (unused placeholder)", () => {
	// content[i].operator joins entry i to i+1 — the last one is a placeholder
	// and unused at replay/render time, so it must NOT be validated (BC)
	const c = Condition.restore([
		{ operator: "or", expression: { key: "a", operator: "eq", value: "b" } },
		{ operator: "whatever", expression: { key: "c", operator: "eq", value: "d" } },
	] as any);
	assertEquals(c.toString(), "a=b or c=d");
});

Deno.test("restore keeps valueless/custom-operator expressions working (BC)", () => {
	// `value: undefined` is dropped by JSON serialization, and custom (unary)
	// operators are supported — both must keep round-tripping
	const c = Condition.restore([
		{ operator: "and", expression: { key: "deleted_at", operator: "isnull" } },
	] as any);
	// note: toJSON() JSON-round-trips, so undefined members are dropped
	assertEquals(c.toJSON(), [
		{
			operator: "and",
			expression: { key: "deleted_at", operator: "isnull" },
		},
	] as any);
});

Deno.test("restore throws on invalid nested condition shape", () => {
	assertThrows(
		() =>
			Condition.restore([
				{ operator: "and", condition: { not: "an array" } },
			] as any),
		TypeError,
		"Invalid dump",
	);
});

Deno.test("restore accepts any key-value-shaped expression with a string key (BC)", () => {
	// destructuring only needs `key`/`operator`/`value` members — e.g. a
	// function object carrying them worked correctly before the validation
	// hardening (reachable via condition-parser transform/preAddHook), and
	// must keep working
	const f: any = () => {};
	f.key = "a";
	f.operator = "eq";
	f.value = "b";
	const c = Condition.restore([{ operator: "and", expression: f }] as any);
	assertEquals(c.toString(), "a=b");
});

Deno.test("restore throws on join operator colliding with a method name", () => {
	// "toString"/"toJSON"/"dump"/"isEmpty"/... are callable Condition members —
	// the old code silently swallowed such entries (cond["toString"](...) is a
	// real call), potentially dropping VALID entries too; now they throw
	for (const operator of ["toString", "toJSON", "dump", "isEmpty", "hasOwnProperty"]) {
		assertThrows(
			() =>
				Condition.restore([
					{ operator, expression: { key: "a", operator: "eq", value: "b" } },
					{
						operator: "and",
						expression: { key: "c", operator: "eq", value: "d" },
					},
				] as any),
			TypeError,
			`Invalid join operator "${operator}"`,
		);
	}
});

Deno.test("restore throws on entries()-iterable non-array dumps", () => {
	// Map/TypedArray/duck-typed `.entries()` used to silently produce an EMPTY
	// condition (renders "" — an empty WHERE matches everything!); now they throw
	for (const dump of [new Map(), new Int8Array(0), { entries: () => [].values() }]) {
		assertThrows(
			() => Condition.restore(dump as any),
			TypeError,
			"Invalid dump",
		);
	}
});
