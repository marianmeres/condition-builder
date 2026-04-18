# @marianmeres/condition-builder

[![NPM version](https://img.shields.io/npm/v/@marianmeres/condition-builder.svg)](https://www.npmjs.com/package/@marianmeres/condition-builder)
[![JSR version](https://jsr.io/badges/@marianmeres/condition-builder)](https://jsr.io/@marianmeres/condition-builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A tool for creating hierarchical logical _conditions_ and _expressions_, mainly
to be used in - but not limited to - an SQL _where_ statement.

## Terminology

### Expression

_Expression_ is the base building block. It consists of `key`, `operator` and `value`.

```ts
`a=b`;
```

### Condition

_Condition_ is a hierarchical collection of one or more _expressions_ or _conditions_
joined by a logical join operator: `and`, `or`, `andNot`, or `orNot`.

```ts
// condition with one expression
`a=b`;

// condition with 2 expressions joined by `or`
`a=b or c=d`;

// condition of multiple hierarchically structured expressions and conditions
`a=b or (c>d and (e<f or g!=h))`;
```

## Installation

deno

```sh
deno add jsr:@marianmeres/condition-builder
```

nodejs

```sh
npm i @marianmeres/condition-builder
```

## Usage

```ts
import { Condition } from "@marianmeres/condition-builder";
```

## Example

The core api consists of 2 methods `and(...)` and `or(...)`. For the _first_ call you can
use any one of them.

```ts
const c = new Condition();

c.and("a", OPERATOR.eq, "b");
// c.or("a", OPERATOR.eq, "b"); // same effect as above for the first call
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

assertEquals(c.toString(), "a=b or c!=d or (e<f and g=h or (i~*j and k!~*l))");

// dump & restore
const c2 = Condition.restore(c.dump());
assertEquals(c2.toString(), "a=b or c!=d or (e<f and g=h or (i~*j and k!~*l))");

// or export the condition as POJO structure for manual processing (eg evaluation)
const structure = c.toJSON();
```

## Operator precedence

SQL's `AND` binds tighter than `OR`. Since the builder API is left-associative
(each chained call folds into a running accumulator), the rendered string is
auto-parenthesized to preserve the order in which calls were made:

```ts
const c = new Condition()
	.and("a", OPERATOR.eq, "1")
	.or("b", OPERATOR.eq, "2")
	.and("c", OPERATOR.eq, "3");

c.toString(); // "(a=1 or b=2) and c=3"
```

Without the extra parentheses the string would be `a=1 or b=2 and c=3`, which
SQL parses as `a=1 OR (b=2 AND c=3)` — a different query. The library emits
only the parentheses that are necessary to disambiguate.

## Array values for `in` / `nin`

When the operator is `in` or `nin` and the value is an array, it is rendered
as a parenthesized, comma-separated list. Each element passes through
`renderValue` individually, so escaping/parameterization applies.

```ts
new Condition()
	.and("id", OPERATOR.in, [1, 2, 3])
	.toString(); // "id in (1,2,3)"
```

## Expression validation and rendering

Point of this package is to create a textual representation of the logical conditions
blocks to be used in an sql _where_ statement. By default, the package is content and
dialect agnostic. Just renders the input as is, which may not be always desired.

### Validation

To _validate_ the condition, you must provide the `validate` function which will validate
every expression before being added to the condition.

```ts
const c = new Condition({
	// this example will allow only a known keys to be set
	validate: (ctx: ExpressionContext) => {
		const { key } = ctx;
		const keyWhitelist = ["foo"];
		if (!keyWhitelist.includes(key)) {
			throw new TypeError(`Key '${key}' not allowed`);
		}
	},
});

// `foo` key is allowed
c.and("foo", OPERATOR.eq, "1");

// `bar` is not
assertThrows(() => c.and("bar", OPERATOR.neq, "2"));
```

### Rendering

To match the textual representation for any specific format you must provide any of the
`renderKey`, `renderValue`, or `renderOperator` functions.

For example for postgresql dialect you may use something like this:

```ts
const c = new Condition({
	// escape identifiers in postgresql dialect
	renderKey: (ctx: ExpressionContext) => `"${ctx.key.replaceAll('"', '""')}"`,
	// escape values in postgresql dialect
	renderValue: (ctx: ExpressionContext) =>
		`'${ctx.value.toString().replaceAll("'", "''")}'`,
	// read below
	// renderOperator(ctx: ExpressionContext): string
});
c.and('fo"o', OPERATOR.eq, "ba'r");
assertEquals(c.toString(), `"fo""o"='ba''r'`);
```

#### Built-in operators rendering

There is a default built-in operator-to-symbol replacement logic (targeting postgresql
dialect), loosely inspired by
[postgrest](https://docs.postgrest.org/en/v12/references/api/tables_views.html).

Any found operator in the map below will be replaced with its symbol. If the operator is
not found in the map, no replacement will happen. You can customize this logic by
providing your own custom `renderOperator` function.

```ts
// default opinionated conversion map of operators to operator symbols.
{
    eq: "=",
    neq: "!=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    like: " ilike ",
    nlike: " not ilike ",
    match: "~*",
    nmatch: "!~*",
    is: " is ",
    nis: " is not ",
    in: " in ",
    nin: " not in ",
    // PostgreSQL ltree operators
    ltree: "~",
    ancestor: "@>",
    descendant: "<@",
};

// but you can safely use any operator you see fit...
const e = new Expression("foo", "==", "bar");
assertEquals(e.toString(), "foo==bar");
```

## PostgreSQL presets

For PostgreSQL output, two presets are shipped:

### Inline SQL (`pgRenderers`)

Double-quotes identifiers and single-quote-escapes string literals. Handles
`null`, booleans, numbers, and bigints natively.

```ts
import { Condition, OPERATOR, pgRenderers } from "@marianmeres/condition-builder";

const c = new Condition()
	.and('fo"o', OPERATOR.eq, "ba'r")
	.and("id", OPERATOR.in, [1, 2, 3])
	.or("active", OPERATOR.is, null);

c.toString(pgRenderers);
// "fo""o"='ba''r' and "id" in (1,2,3) or "active" is null
```

### Parameterized queries (`pgParameterized`) — recommended

Emits `$1`, `$2`, … placeholders and collects values into a shared array.
Values never touch the SQL string, which makes this the safest option for
input you don't control.

```ts
import { Condition, OPERATOR, pgParameterized } from "@marianmeres/condition-builder";

const { options, params } = pgParameterized();

const c = new Condition()
	.and("id", OPERATOR.in, [1, 2, 3])
	.and("name", OPERATOR.eq, "'; drop table users; --");

const sql = c.toString(options);
// "id" in ($1,$2,$3) and "name"=$4
// params: [1, 2, 3, "'; drop table users; --"]

// Pass to your driver:
// await client.query(`select * from users where ${sql}`, params);
```

Pass a custom `startIndex` if you're stitching the condition into a larger
query that already has parameters.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes and breaking-change
details.

## API Reference

See [API.md](./API.md) for the complete API documentation.

## Related

[@marianmeres/condition-parser](https://github.com/marianmeres/condition-parser)
