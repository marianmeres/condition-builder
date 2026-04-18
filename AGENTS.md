# AGENTS.md - Machine-Readable Project Context

## Project Identification

```yaml
name: "@marianmeres/condition-builder"
version: "1.9.4"
type: "library"
language: "TypeScript"
runtime: ["Deno", "Node.js"]
license: "MIT"
repository: "https://github.com/marianmeres/condition-builder"
```

## Purpose

Build hierarchical logical conditions and expressions for SQL WHERE clauses. Supports nested conditions with AND, OR, AND NOT, OR NOT operators. Dialect-agnostic with PostgreSQL defaults.

## Architecture

```
src/
├── mod.ts          # Main entry point (re-exports)
├── expression.ts   # Expression class + operators
├── condition.ts    # Condition class (hierarchical)
└── presets.ts      # PostgreSQL render presets & parameterized-query factory
```

## Core Classes

### Expression

- **Purpose**: Single comparison (key, operator, value)
- **Constructor**: `(key: string, operator: ExpressionOperator, value: any, options?: ExpressionOptions)`
- **Methods**: `toJSON()`, `toString(options?)`

### Condition

- **Purpose**: Hierarchical logical structure
- **Constructor**: `(options?: ExpressionOptions)`
- **Chainable Methods**: `and()`, `or()`, `andNot()`, `orNot()`
- **Serialization**: `toJSON()`, `dump()`, `restore()`
- **Introspection**: `isEmpty()`
- **Output**: `toString(options?)` — auto-parenthesizes mixed AND/OR chains
  to preserve left-associative call order under SQL precedence rules

### Presets (src/presets.ts)

- `pgRenderers` — inline PG render options (quoted identifiers,
  escape-quoted literals)
- `pgParameterized(startIndex?)` — factory returning
  `{ options, params }` for `$n` placeholder output
- `pgLiteral(value)` / `pgQuoteIdentifier(name)` — building blocks

## Key Types

```typescript
type ConditionJoinOperator = "and" | "or" | "andNot" | "orNot";
type ExpressionOperator = keyof typeof OPERATOR | (string & {});

interface ExpressionContext {
  key: string;
  operator: ExpressionOperator;
  value: any;
}

interface ExpressionOptions {
  validate?: (ctx: ExpressionContext) => void;
  renderKey?: (ctx: ExpressionContext) => string;
  renderValue?: (ctx: ExpressionContext) => string;
  renderOperator?: (ctx: ExpressionContext) => string;
  // returns string (incl. "") to commit, or null/undefined/false/void to
  // fall back to per-part rendering
  renderExpression?: (ctx: ExpressionContext) =>
    string | null | undefined | false | void;
}

interface ParameterizedResult {
  options: ExpressionRenderersOptions;
  params: unknown[];
}

// operators whose array values render as "(a,b,c)"
const LIST_OPERATORS: ReadonlySet<string>; // {"in", "nin"}
```

## Built-in Operators

| Key | Symbol | Description |
|-----|--------|-------------|
| eq | = | Equal |
| neq | != | Not equal |
| gt | > | Greater than |
| gte | >= | Greater than or equal |
| lt | < | Less than |
| lte | <= | Less than or equal |
| like | ilike | Case-insensitive pattern match |
| nlike | not ilike | Negated pattern match |
| match | ~* | Case-insensitive regex |
| nmatch | !~* | Negated regex |
| is | is | NULL comparison |
| nis | is not | Negated NULL |
| in | in | List membership |
| nin | not in | Negated list |
| ltree | ~ | PostgreSQL ltree match |
| ancestor | @> | ltree ancestor |
| descendant | <@ | ltree descendant |

## Usage Patterns

### Basic Condition

```typescript
import { Condition, OPERATOR } from "@marianmeres/condition-builder";

const c = new Condition()
  .and("status", OPERATOR.eq, "active")
  .and("age", OPERATOR.gte, 18);

c.toString(); // "status=active and age>=18"
```

### Nested Conditions

```typescript
const c = new Condition()
  .and("a", OPERATOR.eq, "b")
  .or(new Condition().and("c", OPERATOR.lt, "d").and("e", OPERATOR.gt, "f"));

c.toString(); // "a=b or (c<d and e>f)"
```

### Serialization

```typescript
const json = condition.dump();
const restored = Condition.restore(json);
```

### Custom Validation

```typescript
const c = new Condition({
  validate: (ctx) => {
    if (!allowedKeys.includes(ctx.key)) {
      throw new TypeError(`Invalid key: ${ctx.key}`);
    }
  }
});
```

### Custom Rendering (PostgreSQL)

Prefer the shipped presets over hand-rolled renderers:

```typescript
import { Condition, OPERATOR, pgRenderers } from "@marianmeres/condition-builder";

new Condition()
  .and("name", OPERATOR.eq, "ba'r")
  .toString(pgRenderers); // "name"='ba''r'
```

### Parameterized Queries (PostgreSQL, recommended for untrusted input)

```typescript
import { Condition, OPERATOR, pgParameterized } from "@marianmeres/condition-builder";

const { options, params } = pgParameterized();
const sql = new Condition()
  .and("id", OPERATOR.in, [1, 2, 3])
  .toString(options);
// sql: "id" in ($1,$2,$3)
// params: [1, 2, 3]
```

## Invariants and Gotchas

- **Node-scoped options**: each `Condition` keeps its own `options`;
  attaching a sub-condition via `main.and(sub)` does NOT overwrite
  `sub.options`. Render-time options propagate from ancestors to
  descendants via `toString(options)`.
- **Precedence**: `toString()` auto-parenthesizes mixed AND/OR chains so
  the output's SQL parse matches the builder's left-associative call
  order. Tests comparing literal rendered strings should expect parens
  around OR subgroups when followed by AND.
- **Array values + list operators**: `in`/`nin` render arrays as
  `(a,b,c)`; each element passes through `renderValue` independently, so
  parameterization and escaping apply per element.
- **`renderExpression` return semantics**: returning a `string` (including
  `""`) commits that output; returning `null`/`undefined`/`false`/`void`
  falls back to per-part rendering.
- **Option overrides**: `{ key: undefined }` in `toString(options)` is a
  no-op — it does NOT clear an instance-configured renderer. Pass a
  defined function (or the default lambda) to override.
- **Serialization**: `toJSON` / `dump` use `JSON.parse(JSON.stringify)`,
  so BigInt / Date / Map / function / Symbol / `undefined` values are
  not preserved round-trip. Pre-transform exotic values.
- **Internal invariant**: `content[i].operator` is the join operator
  between `content[i]` and `content[i+1]`. The last entry's operator is
  an unused placeholder.

## Development

```bash
# Run tests
deno test

# Build for NPM
deno run -A scripts/build-npm.ts

# Publish
deno publish && npm publish
```

## Dependencies

- **Runtime**: None (zero dependencies)
- **Dev/Build**: @marianmeres/npmbuild, @std/assert, @std/fs, @std/path

## File Descriptions

| File | Purpose |
|------|---------|
| src/mod.ts | Main entry point, re-exports all public API |
| src/expression.ts | Expression class, OPERATOR constants, LIST_OPERATORS, types |
| src/condition.ts | Condition class for hierarchical structures |
| src/presets.ts | PostgreSQL render presets and parameterized-query factory |
| tests/all.test.ts | Comprehensive test suite |
| scripts/build-npm.ts | NPM distribution build script |
| API.md | Complete API reference documentation |
| README.md | User-facing documentation |
| CHANGELOG.md | Release notes and BC-break documentation |

## Related

- [@marianmeres/condition-parser](https://github.com/marianmeres/condition-parser) - Parse condition strings back to structures
