# @marianmeres/condition-builder

A tool for creating a hierarchical logical _condition_ from _expressions_ blocks, mainly
to be used in - but not limited to - an sql _where_ statement.

This package does not _evaluate_ the conditions or _parse_ its textual representation.

## Terminology

### Expression

_Expression_ is the base building block. It consists of `key`, `operator` and `value`.

```ts
`a=b`;
```

### Condition

_Condition_ is a hierarchical collection of one or more _expressions_ or _conditions_
joined by a logical join operator, which is either `and` or `or`.

```ts
// condition with one expression
`a=b`

	// condition with 2 expressions joined by `or`
	`a=b or c=d`

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
npx jsr add @marianmeres/condition-builder
```

## Usage

```ts
import { Condition } from "@marianmeres/condition-builder";
```

## Example

```ts
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

assertEquals(c.toString(), "a=b or c!=d or (e<f and g=h or (i~j and k!~l))");

// dump & restore
const c2 = Condition.restore(c.dump());
assertEquals(c2.toString(), "a=b or c!=d or (e<f and g=h or (i~j and k!~l))");

// or export the condition as POJO structure for manual processing (eg evaluation)
const structure = c.toJSON();
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
};

// but you can safely use any operator you see fit...
const e = new Expression("foo", "==", "bar");
assertEquals(e.toString(), "foo==bar");
```
