/**
 * Ready-made render presets and helpers for common SQL dialects.
 *
 * These turn the (by default dialect-agnostic) condition-builder output into
 * safely-escaped or parameterized SQL without the user having to hand-roll
 * escape functions that may be subtly wrong.
 *
 * @module
 */

import type {
	ExpressionContext,
	ExpressionRenderersOptions,
} from "./expression.ts";

/**
 * Render a PostgreSQL identifier (table or column name) by double-quoting
 * it and escaping any embedded double quotes.
 */
export function pgQuoteIdentifier(name: string): string {
	return `"${String(name).replaceAll('"', '""')}"`;
}

/**
 * Render a literal value for PostgreSQL inline-SQL.
 *
 * Handles `null`, booleans, numbers, and bigints natively; everything else is
 * coerced to string and single-quote-escaped.
 *
 * ⚠️ For untrusted user input prefer {@linkcode pgParameterized}: it removes
 * escaping from the trust-critical path entirely.
 */
export function pgLiteral(value: unknown): string {
	if (value === null || value === undefined) return "null";
	if (typeof value === "number" || typeof value === "bigint") {
		return `${value}`;
	}
	if (typeof value === "boolean") return value ? "true" : "false";
	return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * Render options producing inline PostgreSQL-compatible SQL with identifiers
 * double-quoted and values single-quote-escaped.
 *
 * Array values used with list operators (`in` / `nin`) are handled by the
 * Expression-level list-operator rendering — each element passes through
 * {@linkcode pgLiteral}.
 */
export const pgRenderers: ExpressionRenderersOptions = {
	renderKey: (ctx: ExpressionContext) => pgQuoteIdentifier(ctx.key),
	renderValue: (ctx: ExpressionContext) => pgLiteral(ctx.value),
};

/**
 * Result of {@linkcode pgParameterized}: the rendering `options` to pass
 * into `condition.toString(options)`, and the `params` array that will be
 * populated as the condition renders.
 */
export interface ParameterizedResult {
	options: ExpressionRenderersOptions;
	params: unknown[];
}

/**
 * Factory producing render options that emit PostgreSQL-style numbered
 * placeholders (`$1`, `$2`, …) for values while collecting the actual
 * values into a shared `params` array. This is the safest way to build a
 * query from untrusted input — the values never touch the SQL string.
 *
 * @param startIndex - First placeholder number (default `1`). Useful when
 *                     embedding the condition into a larger query that
 *                     already has parameters.
 *
 * @example
 * ```ts
 * import { Condition, OPERATOR, pgParameterized } from "@marianmeres/condition-builder";
 *
 * const { options, params } = pgParameterized();
 * const c = new Condition()
 *   .and("id", OPERATOR.in, [1, 2, 3])
 *   .and("name", OPERATOR.eq, "'; drop table users; --");
 *
 * const where = c.toString(options);
 * // '"id" in ($1,$2,$3) and "name"=$4'
 * // params: [1, 2, 3, "'; drop table users; --"]
 * ```
 */
export function pgParameterized(startIndex = 1): ParameterizedResult {
	const params: unknown[] = [];
	let idx = startIndex;
	const options: ExpressionRenderersOptions = {
		renderKey: (ctx: ExpressionContext) => pgQuoteIdentifier(ctx.key),
		renderValue: (ctx: ExpressionContext) => {
			params.push(ctx.value);
			return `$${idx++}`;
		},
	};
	return { options, params };
}
