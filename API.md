# API Reference

This document provides a complete reference for all public APIs exposed by `@marianmeres/condition-builder`.

## Table of Contents

- [Classes](#classes)
  - [Condition](#condition)
  - [Expression](#expression)
- [Types](#types)
  - [ConditionJoinOperator](#conditionjoinoperator)
  - [ConditionDump](#conditiondump)
  - [ExpressionOperator](#expressionoperator)
  - [ExpressionContext](#expressioncontext)
  - [ExpressionOptions](#expressionoptions)
  - [ExpressionRenderersOptions](#expressionrenderersoptions)
  - [Validator](#validator)
  - [Renderer](#renderer)
  - [RendererMaybe](#renderermaybe)
  - [ParameterizedResult](#parameterizedresult)
- [Constants](#constants)
  - [OPERATOR](#operator)
  - [OPERATOR_SYMBOL](#operator_symbol)
  - [LIST_OPERATORS](#list_operators)
- [PostgreSQL presets](#postgresql-presets)
  - [pgRenderers](#pgrenderers)
  - [pgParameterized](#pgparameterized)
  - [pgLiteral](#pgliteral)
  - [pgQuoteIdentifier](#pgquoteidentifier)

---

## Classes

### Condition

High-level class for building hierarchical logical conditions by combining multiple expressions with logical operators.

#### Constructor

```ts
new Condition(options?: ExpressionOptions)
```

Creates a new empty condition.

**Parameters:**
- `options` - Optional configuration for validation and rendering of expressions.

**Example:**
```ts
const cond = new Condition();

// With custom validation
const cond = new Condition({
  validate: (ctx) => {
    if (!allowedKeys.includes(ctx.key)) {
      throw new TypeError(`Key "${ctx.key}" not allowed`);
    }
  }
});
```

#### Methods

##### `and(key, operator, value): Condition`

Adds an expression as an AND logical block.

```ts
and(key: string, operator: ExpressionOperator, value: any): Condition
and(condition: Condition): Condition
```

**Parameters:**
- `key` - The field/column name.
- `operator` - The comparison operator (from `OPERATOR` or custom string).
- `value` - The value to compare against.

Or:
- `condition` - A nested `Condition` instance.

**Returns:** The same `Condition` instance for chaining.

**Example:**
```ts
const cond = new Condition()
  .and("status", OPERATOR.eq, "active")
  .and("age", OPERATOR.gte, 18);

cond.toString(); // "status=active and age>=18"
```

##### `or(key, operator, value): Condition`

Adds an expression as an OR logical block.

```ts
or(key: string, operator: ExpressionOperator, value: any): Condition
or(condition: Condition): Condition
```

**Parameters:** Same as `and()`.

**Returns:** The same `Condition` instance for chaining.

**Example:**
```ts
const cond = new Condition()
  .and("a", OPERATOR.eq, "1")
  .or("b", OPERATOR.eq, "2");

cond.toString(); // "a=1 or b=2"
```

##### `andNot(key, operator, value): Condition`

Adds an expression as an AND NOT logical block.

```ts
andNot(key: string, operator: ExpressionOperator, value: any): Condition
andNot(condition: Condition): Condition
```

**Parameters:** Same as `and()`.

**Returns:** The same `Condition` instance for chaining.

**Example:**
```ts
const cond = new Condition()
  .and("a", OPERATOR.eq, "1")
  .andNot("b", OPERATOR.eq, "2");

cond.toString(); // "a=1 and not b=2"
```

##### `orNot(key, operator, value): Condition`

Adds an expression as an OR NOT logical block.

```ts
orNot(key: string, operator: ExpressionOperator, value: any): Condition
orNot(condition: Condition): Condition
```

**Parameters:** Same as `and()`.

**Returns:** The same `Condition` instance for chaining.

**Example:**
```ts
const cond = new Condition()
  .and("a", OPERATOR.eq, "1")
  .orNot(new Condition().and("b", OPERATOR.eq, "2"));

cond.toString(); // "a=1 or not (b=2)"
```

##### `isEmpty(): boolean`

Returns `true` when the condition has no non-empty expressions or sub-conditions
(recursive). An empty condition renders to the empty string and contributes
nothing to a parent's output.

**Example:**
```ts
new Condition().isEmpty();                              // true
new Condition().and(new Condition()).isEmpty();         // true (nested empty)
new Condition().and("a", OPERATOR.eq, "b").isEmpty();   // false
```

##### `toJSON(): ConditionDump`

Returns the condition data as a plain object. Creates a deep clone that can be safely serialized.

**Returns:** A `ConditionDump` array representing the condition structure.

**Example:**
```ts
const cond = new Condition().and("a", OPERATOR.eq, "b");
const data = cond.toJSON();
// [{ operator: "and", expression: { key: "a", operator: "eq", value: "b" } }]
```

##### `dump(): string`

Returns the condition as a JSON string.

**Returns:** A JSON string representation.

**Example:**
```ts
const cond = new Condition().and("a", OPERATOR.eq, "b");
const json = cond.dump();
// Store in database, send over network, etc.
```

##### `toString(options?): string`

Renders the condition as a string.

```ts
toString(options?: Partial<ExpressionRenderersOptions>): string
```

**Parameters:**
- `options` - Optional rendering options. Defined keys override the
  instance's own options and propagate to nested conditions and
  expressions. Keys whose value is `undefined` are ignored (they do NOT
  erase instance-configured renderers).

**Returns:** The rendered string representation.

**Precedence:** SQL's `AND` binds tighter than `OR`. Because the builder
API is left-associative, the output is auto-parenthesized so that mixed
AND/OR chains parse as SQL the way they read in code. For example,
`.and(a).or(b).and(c)` renders as `(a or b) and c`, not `a or b and c`
(which SQL would parse as `a or (b and c)`).

**Example:**
```ts
const cond = new Condition()
  .and("a", OPERATOR.eq, "b")
  .or("c", OPERATOR.neq, "d");

cond.toString(); // "a=b or c!=d"

// With custom renderers for PostgreSQL
cond.toString({
  renderKey: (ctx) => `"${ctx.key}"`,
  renderValue: (ctx) => `'${ctx.value}'`
}); // "a"='b' or "c"!='d'
```

#### Static Methods

##### `Condition.restore(dump, options?): Condition`

Creates a new Condition instance from a serialized dump.

```ts
static restore(dump: string | ConditionDump, options?: ExpressionOptions): Condition
```

**Parameters:**
- `dump` - A JSON string or plain object representing the condition.
- `options` - Optional expression options to apply during restoration.

**Returns:** A new `Condition` instance with the restored structure.

**Throws:** `TypeError` if the dump contains invalid data.

**Example:**
```ts
const original = new Condition().and("a", OPERATOR.eq, "b");
const json = original.dump();

// Later, restore from JSON
const restored = Condition.restore(json);
restored.toString(); // "a=b"

// With validation during restore
const restored = Condition.restore(json, {
  validate: (ctx) => {
    if (ctx.key === "forbidden") throw new Error("Forbidden key");
  }
});
```

---

### Expression

Base building block for conditions. Represents a single comparison consisting of a key, operator, and value.

#### Constructor

```ts
new Expression(key: string, operator: ExpressionOperator, value: any, options?: ExpressionOptions)
```

Creates a new expression.

**Parameters:**
- `key` - The field/column name.
- `operator` - The comparison operator.
- `value` - The value to compare against.
- `options` - Optional configuration for validation and rendering.

**Example:**
```ts
const expr = new Expression("age", OPERATOR.gte, 18);
expr.toString(); // "age>=18"

// With custom operator
const expr = new Expression("foo", "==", "bar");
expr.toString(); // "foo==bar"
```

#### Properties

- `key: string` - The field/column name.
- `operator: ExpressionOperator` - The comparison operator.
- `value: any` - The value to compare against.
- `options: ExpressionOptions` - The configuration options.

#### Methods

##### `toJSON(): ExpressionContext`

Returns the expression data as a plain object.

**Returns:** An `ExpressionContext` object.

**Example:**
```ts
const expr = new Expression("name", OPERATOR.eq, "John");
expr.toJSON(); // { key: "name", operator: "eq", value: "John" }
```

##### `toString(options?): string`

Renders the expression as a string.

```ts
toString(options?: Partial<ExpressionRenderersOptions>): string
```

**Parameters:**
- `options` - Optional rendering options. Keys whose value is `undefined`
  are ignored (they do NOT erase instance-configured renderers).

**Returns:** The rendered string representation.

**List-operator array values:** When `operator` is in
[`LIST_OPERATORS`](#list_operators) (`in` / `nin`) and `value` is an
`Array`, the value is rendered as a parenthesized, comma-separated list
with each element passing through `renderValue` individually.

**Example:**
```ts
const expr = new Expression("age", OPERATOR.gte, 18);
expr.toString(); // "age>=18"

expr.toString({
  renderKey: (ctx) => `"${ctx.key}"`,
  renderValue: (ctx) => `'${ctx.value}'`
}); // "age">='18'

// Array + list operator
new Expression("id", OPERATOR.in, [1, 2, 3]).toString();
// "id in (1,2,3)"
```

---

## Types

### ConditionJoinOperator

Operator used to logically combine conditions.

```ts
type ConditionJoinOperator = "and" | "or" | "andNot" | "orNot"
```

### ConditionDump

Serializable representation of a condition as a plain object array.

```ts
type ConditionDump = {
  operator: ConditionJoinOperator;
  condition?: ConditionDump | undefined;
  expression: ExpressionContext | undefined;
}[]
```

### ExpressionOperator

Type for expression operators. Can be a key from `OPERATOR` or any custom string.
The `(string & {})` trick preserves editor autocomplete for built-in keys
while still allowing arbitrary string operators.

```ts
type ExpressionOperator = keyof typeof OPERATOR | (string & {})
```

### ExpressionContext

Core expression data structure.

```ts
interface ExpressionContext {
  key: string;
  operator: ExpressionOperator;
  value: any;
}
```

### ExpressionOptions

Options for expression validation and rendering.

```ts
interface ExpressionOptions extends ExpressionRenderersOptions {
  validate?: Validator;
}
```

### ExpressionRenderersOptions

Options for customizing expression output rendering.

```ts
interface ExpressionRenderersOptions {
  renderKey?: Renderer;
  renderValue?: Renderer;
  renderOperator?: Renderer;
  renderExpression?: RendererMaybe;
}
```

**Fields:**

- `renderKey` - Function to render the key portion.
- `renderValue` - Function to render the value portion.
- `renderOperator` - Function to render the operator portion.
- `renderExpression` - Function to render the entire expression. If provided and returns a truthy value, individual renderers are bypassed.

### Validator

Function type for validating expression data.

```ts
type Validator = (context: ExpressionContext) => void
```

Should throw an error if validation fails.

### Renderer

Function type for rendering expression data items.

```ts
type Renderer = (context: ExpressionContext) => string
```

### RendererMaybe

Function type for optionally rendering expression data items.

```ts
type RendererMaybe = (context: ExpressionContext) => string | null | undefined | false | void
```

Returns a string — including the empty string `""` — to commit that output
verbatim; returns `null` / `undefined` / `false` / `void` to fall back to
the default per-part (`renderKey` / `renderOperator` / `renderValue`)
rendering.

### ParameterizedResult

Return shape of [`pgParameterized`](#pgparameterized).

```ts
interface ParameterizedResult {
  options: ExpressionRenderersOptions;
  params: unknown[];
}
```

The `options` are passed to `condition.toString(options)`; the `params`
array is populated as the condition renders and is intended to be passed
alongside the rendered SQL to a database driver.

---

## Constants

### OPERATOR

Map of supported operators.

```ts
const OPERATOR = {
  eq: "eq",       // Equal
  neq: "neq",     // Not equal
  gt: "gt",       // Greater than
  gte: "gte",     // Greater than or equal
  lt: "lt",       // Less than
  lte: "lte",     // Less than or equal
  like: "like",   // Pattern match (case-insensitive)
  nlike: "nlike", // Not pattern match
  match: "match", // Regex match (case-insensitive)
  nmatch: "nmatch", // Not regex match
  is: "is",       // IS (for NULL comparisons)
  nis: "nis",     // IS NOT
  in: "in",       // IN (list membership)
  nin: "nin",     // NOT IN
  ltree: "ltree", // PostgreSQL ltree match
  ancestor: "ancestor", // PostgreSQL ltree ancestor or equal
  descendant: "descendant", // PostgreSQL ltree descendant or equal
} as const
```

### OPERATOR_SYMBOL

Built-in conversion map of operators to SQL symbols (targeting PostgreSQL dialect).

```ts
const OPERATOR_SYMBOL = {
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
  ltree: "~",
  ancestor: "@>",
  descendant: "<@",
} as const
```

**Note:** Custom operators not in this map will be rendered as-is. You can override the rendering behavior with a custom `renderOperator` function.

### LIST_OPERATORS

Set of operator keys whose values are rendered as parenthesized,
comma-separated lists when the value is an `Array`.

```ts
const LIST_OPERATORS: ReadonlySet<string>; // contains "in", "nin"
```

---

## PostgreSQL presets

Ready-made render presets and helpers for PostgreSQL output. Importing them
is optional — they are regular `ExpressionRenderersOptions` values / helper
functions built on the public API.

### pgRenderers

Render options producing inline PostgreSQL-compatible SQL. Identifiers are
double-quoted, string literals are single-quote-escaped, and primitive
non-string types (`null`, boolean, number, bigint) render natively.

```ts
const pgRenderers: ExpressionRenderersOptions
```

**Example:**
```ts
import { Condition, OPERATOR, pgRenderers } from "@marianmeres/condition-builder";

new Condition()
  .and('fo"o', OPERATOR.eq, "ba'r")
  .or("active", OPERATOR.is, null)
  .toString(pgRenderers);
// "fo""o"='ba''r' or "active" is null
```

> ⚠️ For untrusted user input prefer [`pgParameterized`](#pgparameterized) —
> it removes escaping from the trust-critical path entirely.

### pgParameterized

Factory producing render options that emit `$1`, `$2`, … placeholders for
values, collecting the actual values into a returned `params` array.

```ts
function pgParameterized(startIndex?: number): ParameterizedResult
```

**Parameters:**
- `startIndex` - First placeholder number (default `1`). Useful when the
  condition is embedded in a larger query that already has parameters.

**Returns:** `{ options, params }` — pass `options` to `condition.toString()`
and `params` to your database driver.

**Example:**
```ts
import { Condition, OPERATOR, pgParameterized } from "@marianmeres/condition-builder";

const { options, params } = pgParameterized();
const c = new Condition()
  .and("id", OPERATOR.in, [1, 2, 3])
  .and("name", OPERATOR.eq, "'; drop table users; --");

const where = c.toString(options);
// "id" in ($1,$2,$3) and "name"=$4
// params: [1, 2, 3, "'; drop table users; --"]
```

Array values with list operators (`in` / `nin`) produce one placeholder
per element — each is appended to `params` in order.

### pgLiteral

Render a single value as an inline PostgreSQL literal.

```ts
function pgLiteral(value: unknown): string
```

Handles `null`/`undefined` → `null`, numbers and bigints → bare numeric,
booleans → `true`/`false`, everything else coerced to string and
single-quote-escaped.

### pgQuoteIdentifier

Render a PostgreSQL identifier by double-quoting and escaping embedded
double quotes.

```ts
function pgQuoteIdentifier(name: string): string
```
