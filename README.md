# @marianmeres/condition-builder

Utility to build _expressions_ as hierarchical logical _condition_ blocks.

## Terminology

### Expression

_Expression_ is the base condition building block. Consists of `key`, `operator` and `value`.
In the example below `a` is the `key`, `=` is the `operator` and `b` is the `value`.

```ts
`a=b`
```

### Condition

_Condition_ is a hierarchical collection of one or more _expressions_ or _conditions_ 
joined by a _condition_ logical join operator, which is either `and` or `or`.

```ts
// condition with one expression
`(a=b)`

// condition with 2 expression join by `or`
`(a=b or c=d)`

// condition of multiple hierarchically structure expressions and conditions
`(a=b or (c>d and (e<f or g!=h)))`
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
```