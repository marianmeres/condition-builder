# CLAUDE.md

## Quick Context

TypeScript library for building SQL WHERE conditions with nested logical operators.

## Structure

- `src/mod.ts` - Entry point
- `src/expression.ts` - `Expression` class (key-operator-value), `OPERATOR`, `LIST_OPERATORS`
- `src/condition.ts` - `Condition` class (hierarchical AND/OR/NOT)
- `src/presets.ts` - `pgRenderers`, `pgParameterized`, `pgLiteral`, `pgQuoteIdentifier`
- `tests/all.test.ts` - Tests

## Core API

```typescript
import { Condition, Expression, OPERATOR } from "@marianmeres/condition-builder";

// Build condition
const c = new Condition()
  .and("a", OPERATOR.eq, "b")
  .or("c", OPERATOR.neq, "d")
  .andNot(new Condition().and("e", OPERATOR.lt, "f"));

c.toString();  // "a=b or c!=d and not (e<f)"
c.dump();      // JSON string
Condition.restore(json);  // Restore from JSON
```

## Key Points

- Zero runtime dependencies
- Chainable fluent API
- Operators: `and`, `or`, `andNot`, `orNot`
- Customizable validation and rendering
- PostgreSQL operator symbols by default; `pgRenderers` / `pgParameterized` for safe output
- Supports custom operators
- Arrays + `in`/`nin` render as `(a,b,c)`
- `toString()` auto-parenthesizes mixed AND/OR to preserve left-associative call order under SQL precedence

## Commands

```bash
deno test                        # Run tests
deno run -A scripts/build-npm.ts # Build NPM
```

## Docs

- [API.md](./API.md) - Full API reference
- [AGENTS.md](./AGENTS.md) - Machine-readable context
- [CHANGELOG.md](./CHANGELOG.md) - Release notes & BC-break details
