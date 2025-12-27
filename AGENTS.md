# AGENTS.md - Machine-Readable Project Context

## Project Identification

```yaml
name: "@marianmeres/condition-builder"
version: "1.9.2"
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
└── condition.ts    # Condition class (hierarchical)
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
- **Output**: `toString(options?)`

## Key Types

```typescript
type ConditionJoinOperator = "and" | "or" | "andNot" | "orNot";
type ExpressionOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "nlike" | "match" | "nmatch" | "is" | "nis" | "in" | "nin" | "ltree" | "ancestor" | "descendant" | string;

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
  renderExpression?: (ctx: ExpressionContext) => string | undefined;
}
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

```typescript
const c = new Condition({
  renderKey: (ctx) => `"${ctx.key.replaceAll('"', '""')}"`,
  renderValue: (ctx) => `'${ctx.value.toString().replaceAll("'", "''")}'`
});
```

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
| src/expression.ts | Expression class, OPERATOR constants, types |
| src/condition.ts | Condition class for hierarchical structures |
| tests/all.test.ts | Comprehensive test suite (12 tests) |
| scripts/build-npm.ts | NPM distribution build script |
| API.md | Complete API reference documentation |
| README.md | User-facing documentation |

## Related

- [@marianmeres/condition-parser](https://github.com/marianmeres/condition-parser) - Parse condition strings back to structures
