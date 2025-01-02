import { assertEquals, assertThrows } from "@std/assert";
import { Expression, OPERATOR, type ExpressionContext } from "../expression.ts";
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
					.and("k", OPERATOR.nmatch, "l")
			)
	);

	const expected = "a=b or c!=d or (e<f and g=h or (i~j and k!~l))";
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
