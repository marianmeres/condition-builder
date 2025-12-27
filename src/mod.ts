/**
 * A tool for creating hierarchical logical conditions and expressions.
 *
 * This package provides utilities for building SQL-like WHERE clauses
 * with support for complex nested logical operators (AND, OR, AND NOT, OR NOT).
 *
 * @example Basic Usage
 * ```ts
 * import { Condition, OPERATOR } from "@marianmeres/condition-builder";
 *
 * const cond = new Condition()
 *   .and("status", OPERATOR.eq, "active")
 *   .and("age", OPERATOR.gte, 18);
 *
 * console.log(cond.toString()); // "status=active and age>=18"
 * ```
 *
 * @example Nested Conditions
 * ```ts
 * import { Condition, OPERATOR } from "@marianmeres/condition-builder";
 *
 * const cond = new Condition()
 *   .and("a", OPERATOR.eq, "b")
 *   .or(new Condition()
 *     .and("c", OPERATOR.lt, "d")
 *     .and("e", OPERATOR.gt, "f")
 *   );
 *
 * console.log(cond.toString()); // "a=b or (c<d and e>f)"
 * ```
 *
 * @example Serialization
 * ```ts
 * const cond = new Condition().and("a", OPERATOR.eq, "b");
 * const json = cond.dump();
 * const restored = Condition.restore(json);
 * ```
 *
 * @module
 */

export * from "./condition.ts";
export * from "./expression.ts";
