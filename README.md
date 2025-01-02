# @marianmeres/condition-builder

A tool for creating a hierarchical logical _condition_ from _expressions_ blocks, mainly
to be used in - but not limited to - an sql _where_ statement.

This package does not _evaluate_ the conditions or _parse_ its textual representation.

## Terminology

### Expression

_Expression_ is the base building block. Consists of `key`, `operator` and `value`.

```ts
`a=b`
```

### Condition

_Condition_ is a hierarchical collection of one or more _expressions_ or _conditions_ 
joined by a logical join operator, which is either `and` or `or`.

```ts
// condition with one expression
`a=b`

// condition with 2 expression join by `or`
`a=b or c=d`

// condition of multiple hierarchically structured expressions and conditions
`a=b or (c>d and (e<f or g!=h))`
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
                .and("k", OPERATOR.nmatch, "l")
        )
);

assertEquals(c.toString(), "a=b or c!=d or (e<f and g=h or (i~j and k!~l))";);

// dump & restore
const c2 = Condition.restore(c.dump());
assertEquals(c2.toString(), "a=b or c!=d or (e<f and g=h or (i~j and k!~l))";);

// or export the condition as POJO structure for manual processing (evaluation)
const structure = c.toJSON();
```

## Expression operators

There is a collection of built-in operators loosely inspired from 
[postgrest](https://docs.postgrest.org/en/v12/references/api/tables_views.html) but you
are not limited to them. You can freely use anything as an operator, it will be rendered
as is. Or you can customize the rendering by providing `renderOperator` function mentioned
below.

```ts
// opinionated collection of operators
export const OPERATOR = {
    eq: "eq", neq: "neq", gt: "gt", gte: "gte", lt: "lt", lte: "lte",
    match: "match", nmatch: "nmatch", in: "in", nin: "nin",
} as const;

// opinionated conversion map of operators to operator symbols.
export const OPERATOR_SYMBOL: Record<keyof typeof OPERATOR, string> = {
    eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=",
    match: "~", nmatch: "!~", in: "@>", nin: "!@>",
} as const;

// but you can safely use any operator you see fit...
const e = new Expression("foo", "==", "bar");
assertEquals(e.toString(), "foo==bar");
```

## Expression validation and rendering

Point of this package is to create a textual representation of the logical conditions
blocks to be used in an sql _where_ statement. By default, the package is content and 
dialect agnostic. Just renders the input as is, which may not be always desired.

### Validation

To _validate_ the expression keys, you must provide the `validate` function.

```ts
const c = new Condition({
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

To match the textual representation for any specific format you must provide any of 
the `renderKey`, `renderValue`, or `renderOperator` functions. 

For example for postgresql dialect you may use something like this:

```ts
const c = new Condition({
    // escape identifiers in postgresql dialect
    renderKey: (ctx: ExpressionContext) => `"${ctx.key.replaceAll('"', '""')}"`,
    // escape values in postgresql dialect
    renderValue: (ctx: ExpressionContext) => `'${ctx.value.toString().replaceAll("'", "''")}'`,
});
c.and('fo"o', OPERATOR.eq, "ba'r");
assertEquals(c.toString(), `"fo""o"='ba''r'`);
```