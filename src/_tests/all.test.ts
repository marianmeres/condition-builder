import { assertEquals, assertThrows } from "@std/assert";
import {
	Expression,
	type ExpressionContext,
	OPERATOR,
	type Validator,
} from "../expression.ts";
import { Condition } from "../condition.ts";

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
	// console.log(JSON.stringify(c.toJSON(), null, 4));

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

	// console.log(c.toJSON());
	const expected = "a=b and (c=d or e=f)";
	assertEquals(c.toString(), expected);

	// dump & restore
	const c2 = Condition.restore(c.dump());
	assertEquals(c.toJSON(), c2.toJSON());
	assertEquals(c2.toString(), expected);
});

Deno.test("(a=b) and (c=d)", () => {
	const c = new Condition();

	c.and(new Condition().and("a", OPERATOR.eq, "b")).and(
		new Condition().and("c", OPERATOR.eq, "d"),
	);
	// console.log(c.toString(), c.toJSON());

	const expected = "(a=b) and (c=d)";
	assertEquals(c.toString(), expected);

	// dump & restore
	const c2 = Condition.restore(c.dump());
	assertEquals(c.toJSON(), c2.toJSON());
	assertEquals(c2.toString(), expected);
});

Deno.test("a=b or c=d or e=f", () => {
	const c = new Condition();

	c.or("a", OPERATOR.eq, "b")
		.or("c", OPERATOR.eq, "d")
		.or("e", OPERATOR.eq, "f");

	// console.log(c.toString(), c.toJSON());
	const expected = "a=b or c=d or e=f";
	assertEquals(c.toString(), expected);

	// dump & restore
	const c2 = Condition.restore(c.dump());
	assertEquals(c.toJSON(), c2.toJSON());
	assertEquals(c2.toString(), expected);
});

Deno.test("a=b and c=d or e=f and g=h", () => {
	const c = new Condition();

	c.and("a", OPERATOR.eq, "b")
		.and("c", OPERATOR.eq, "d")
		.or("e", OPERATOR.eq, "f")
		.and("g", OPERATOR.eq, "h");

	// console.log(c.toString(), c.toJSON());

	const expected = "a=b and c=d or e=f and g=h";
	assertEquals(c.toString(), expected);

	// dump & restore
	const c2 = Condition.restore(c.dump());

	// console.log(c2.toJSON());

	assertEquals(c.toJSON(), c2.toJSON());
	assertEquals(c2.toString(), expected);
});
