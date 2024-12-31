import { assertEquals } from "@std/assert";
import { Expression, OPERATOR } from "../expression.ts";
import { Group } from "../group.ts";

Deno.test("expression", () => {
	const e = new Expression("foo", OPERATOR.eq, "bar");
	assertEquals(e.toString(), "foo='bar'");
});

Deno.test("group", () => {
	const g = new Group();

	g.and("foo", OPERATOR.eq, "bar");
	assertEquals(g.toString(), "foo='bar'");

	g.or("baz", OPERATOR.not_eq, "bat");
	assertEquals(g.toString(), "foo='bar' or baz!='bat'");

	g.or(
		new Group()
			.and("hey", OPERATOR.lt, "ho")
			.and("lets", OPERATOR.eq, "go")
			.or(
				new Group()
					.and("some", OPERATOR.match, "another")
					.and("jack", OPERATOR.not_match, "son")
			)
	);

	assertEquals(
		g.toString(),
		"foo='bar' or baz!='bat' or (hey<'ho' and lets='go' or (some~'another' and jack!~'son'))"
	);
});
