# Changelog

## Unreleased

### Audit fixes (2026-04-18)

Comprehensive audit of the package uncovered several bugs, design flaws, and
missing features. All items below are shipped in a single change.

#### New features

- **`pgRenderers`** — ready-made PostgreSQL render preset that double-quotes
  identifiers and single-quote-escapes string literals, with native handling
  of `null`, booleans, numbers, and bigints.
- **`pgParameterized(startIndex?)`** — factory that returns render options
  emitting `$1`, `$2`, … placeholders and a shared `params` array. Values
  never touch the SQL string, which removes escaping from the trust-critical
  path entirely. **This is the recommended way to build queries from
  untrusted input.**
- **`pgLiteral`**, **`pgQuoteIdentifier`** — the building blocks behind
  `pgRenderers`, exported for ad-hoc use.
- **`LIST_OPERATORS`** — exported `Set` of operators that treat array values
  as list-literals (`in`, `nin`).
- **`Condition.prototype.isEmpty()`** — returns `true` for conditions with
  no non-empty expressions or sub-conditions (recursive).

#### Bug fixes

- **Sub-condition `options` are no longer mutated on attach.** Previously
  `main.and(sub)` would overwrite `sub.options` with `main.options`, so any
  later `sub.and(...)` call unexpectedly ran `main`'s validator instead of
  `sub`'s. Options now propagate lazily at render time.
- **`toString()` renders sub-conditions once** instead of twice (the
  emptiness check used to compute the rendered string and then throw it
  away).
- **Explicit `{ renderValue: undefined }` in `toString(options)` no longer
  erases instance-configured renderers.** Only defined keys override.
- **`renderExpression` returning an empty string is honored.** Previously the
  truthy-check caused `""` to fall through to per-part rendering; now any
  `string` (including `""`) short-circuits. Non-string falsy values
  (`null`, `undefined`, `false`, `void`) still fall back as before.
- **Array values for `in` / `nin` render as a parenthesized,
  comma-separated list**, with each element passed through `renderValue`
  individually. Previously arrays rendered via `${value}` as a bare
  comma-joined string (`id in 1,2,3` → invalid SQL).

#### Correctness: operator precedence

`Condition.toString()` now auto-parenthesizes mixed AND/OR chains so that
the rendered SQL evaluates the way the builder reads (left-associative).
Previously, mixing `.or(...)` and `.and(...)` at the same level emitted a
flat string whose SQL parse silently differed from the builder call order,
because SQL's `AND` binds tighter than `OR`.

```ts
const c = new Condition()
  .and("a", OPERATOR.eq, "1")
  .or("b", OPERATOR.eq, "2")
  .and("c", OPERATOR.eq, "3");

// before: "a=1 or b=2 and c=3"   ← SQL: a=1 OR (b=2 AND c=3)
// after:  "(a=1 or b=2) and c=3" ← SQL: (a=1 OR b=2) AND c=3
```

### Potentially breaking changes

All of the following are behavior changes. They shift output in the
direction of correctness, but if you were depending on the prior behavior
you will see a difference:

1. **Precedence output.** Mixed AND/OR chains now include parentheses
   around OR-subgroups when followed by AND. If you were comparing rendered
   strings verbatim against fixtures, update them. Semantics of the output
   as SQL now match the builder's call order.
2. **Sub-condition `options` no longer shared with parent.** If you relied
   on `main.and(sub)` transplanting `main`'s validator/renderers onto
   `sub` for subsequent standalone `sub.and(...)` calls or
   `sub.toString()` invocations, that behavior is gone. Render-time
   propagation is unchanged for the normal path (`main.toString()`);
   standalone `sub.toString()` now uses `sub`'s own options.
3. **`{ renderValue: undefined }` is now a no-op.** If you were using
   explicit-`undefined` to "reset" a renderer, pass the default lambda
   explicitly (`renderValue: ({value}) => \`${value}\``).
4. **`renderExpression` returning `""` now renders as the empty string.**
   If you accidentally returned `""` and relied on falling through, return
   `null`/`undefined`/`false` instead.
5. **Array values with `in`/`nin` now render as `(a,b,c)`.** If you were
   pre-serializing arrays into a single pre-parenthesized string, you will
   get double parens. Pass the array directly.

Items 1 and 5 are unambiguously correctness fixes — the previous output
was broken SQL. Items 2–4 are edge-case bug fixes; the previous behavior
was surprising.
