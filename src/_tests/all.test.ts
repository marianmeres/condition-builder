import { assertEquals } from "@std/assert";
import { Expression, OPERATOR, RenderContext } from "../expression.ts";
import { Condition } from "../condition.ts";

Deno.test("expression", () => {
	const e = new Expression("foo", OPERATOR.eq, "bar");
	assertEquals(e.toString(), "foo='bar'");
});

Deno.test("condition", () => {
	const g = new Condition();

	g.and("foo", OPERATOR.eq, "bar");
	assertEquals(g.toString(), "foo='bar'");

	g.or("baz", OPERATOR.not_eq, "bat");
	assertEquals(g.toString(), "foo='bar' or baz!='bat'");

	g.or(
		new Condition()
			.and("hey", OPERATOR.lt, "ho")
			.and("lets", OPERATOR.eq, "go")
			.or(
				new Condition()
					.and("some", OPERATOR.match, "another")
					.and("jack", OPERATOR.not_match, "son")
			)
	);

	assertEquals(
		g.toString(),
		"foo='bar' or baz!='bat' or (hey<'ho' and lets='go' or (some~'another' and jack!~'son'))"
	);
});

Deno.test("custom renderers", () => {
	const g = new Condition({
		expression: {
			renderValue: (context: RenderContext) => context.value.toUpperCase(),
		},
	});
	g.and("foo", OPERATOR.eq, "bar");
	assertEquals(g.toString(), "foo=BAR");
});
