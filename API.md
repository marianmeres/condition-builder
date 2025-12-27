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
- [Constants](#constants)
  - [OPERATOR](#operator)
  - [OPERATOR_SYMBOL](#operator_symbol)

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
- `options` - Optional rendering options that override instance options.

**Returns:** The rendered string representation.

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
- `options` - Optional rendering options that override instance options.

**Returns:** The rendered string representation.

**Example:**
```ts
const expr = new Expression("age", OPERATOR.gte, 18);
expr.toString(); // "age>=18"

expr.toString({
  renderKey: (ctx) => `"${ctx.key}"`,
  renderValue: (ctx) => `'${ctx.value}'`
}); // "age">='18'
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

```ts
type ExpressionOperator = keyof typeof OPERATOR | string
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

Returns a string if rendering should be applied, or a falsy value to fall back to default rendering.

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
