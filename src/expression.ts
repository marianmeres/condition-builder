/**
 * Expression and rendering utilities for building logical conditions.
 *
 * This module provides the base {@linkcode Expression} class and related types
 * for building individual logical expressions consisting of a key, operator, and value.
 *
 * @example
 * ```ts
 * import { Expression, OPERATOR } from "@marianmeres/condition-builder";
 *
 * const expr = new Expression("age", OPERATOR.gte, 18);
 * console.log(expr.toString()); // "age>=18"
 * ```
 *
 * @module
 */

/**
 * Map of supported operators.
 *
 * Inspired by [PostgREST operators](https://docs.postgrest.org/en/v12/references/api/tables_views.html).
 *
 * @example
 * ```ts
 * import { OPERATOR } from "@marianmeres/condition-builder";
 *
 * console.log(OPERATOR.eq);  // "eq"
 * console.log(OPERATOR.gte); // "gte"
 * ```
 */
export const OPERATOR = {
	eq: "eq",
	neq: "neq", // not equal
	gt: "gt",
	gte: "gte",
	lt: "lt",
	lte: "lte",
	like: "like",
	nlike: "nlike",
	match: "match",
	nmatch: "nmatch", // not match
	is: "is",
	nis: "nis",
	in: "in",
	nin: "nin", // not in
	// ltree related
	ltree: "ltree",
	ancestor: "ancestor", // ancestor or equal
	descendant: "descendant", // descendant or equal
} as const;

/** Built-in conversion map of operators to operator symbols (targeting pg dialect). */
export const OPERATOR_SYMBOL: Record<keyof typeof OPERATOR, string> = {
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
	// https://www.postgresql.org/docs/17/ltree.html
	ltree: "~",
	ancestor: "@>", // A @> B --> "A is ancestor of B"
	descendant: "<@", // B <@ A --> "B is descendant of A"
} as const;

/** Key of `OPERATOR`. */
export type ExpressionOperator = keyof typeof OPERATOR | string;

/** Core expression internal data. */
export interface ExpressionContext {
	key: string;
	operator: ExpressionOperator;
	value: any;
}

/** Function used to validate expression data. No-op by default. */
export type Validator = (context: ExpressionContext) => void;

/**
 * Function to render expression data items.
 *
 * @param context - The expression context containing key, operator, and value.
 * @returns The rendered string representation.
 */
export type Renderer = (context: ExpressionContext) => string;

/**
 * Function to optionally render expression data items.
 *
 * Returns a string if rendering should be applied, or a falsy value
 * to indicate that the default rendering should be used instead.
 *
 * @param context - The expression context containing key, operator, and value.
 * @returns The rendered string, or a falsy value to fall back to default rendering.
 */
export type RendererMaybe = (
	context: ExpressionContext
) => string | null | undefined | false | void;

/** Options used for output rendering */
export interface ExpressionRenderersOptions {
	/**
	 * Function used to convert expression key to string. No-op by default.
	 * @example For postgresql dialect
	 * ```ts
	 * (context: ExpressionContext): string => {
	 * return `"${context.key.toString().replaceAll('"', '""')}"`;
	 * }
	 * ```
	 */
	renderKey?: Renderer;
	/**
	 * Function used to convert expression value to string. No-op by default.
	 * @example For postgresql dialect
	 * ```ts
	 * (context: ExpressionContext): string => {
	 * return `'${context.key.toString().replaceAll("'", "''")}'`;
	 * }
	 * ```
	 */
	renderValue?: Renderer;
	/**
	 * Function used to convert expression operator to string.
	 */
	renderOperator?: Renderer;
	/** Function to render expression to string. If provided, will be used with
	 * higher priority than individual renderers. If will return false-y, normal
	 * render flow (key, operator, value) will normally follow.
	 */
	renderExpression?: RendererMaybe;
}

/** Expression options used for validation and rendering. */
export interface ExpressionOptions extends ExpressionRenderersOptions {
	/** Function used to validate expression data. No-op by default. */
	validate?: Validator;
}

/**
 * Base condition building block. Consists of `key`, `operator` and `value`.
 *
 * @example
 * ```ts
 * const e = new Expression('foo', OPERATOR.eq, 'bar');
 * assertEquals(e.toString(), 'foo=bar')
 * ```
 */
export class Expression {
	constructor(
		public key: string,
		public operator: ExpressionOperator,
		public value: any,
		public options: ExpressionOptions = {}
	) {
		this.options?.validate?.({
			key: this.key,
			operator: this.operator,
			value: this.value,
		});
	}

	/**
	 * Returns the expression data as a plain object.
	 *
	 * @returns A plain object containing the key, operator, and value.
	 *
	 * @example
	 * ```ts
	 * const expr = new Expression("name", OPERATOR.eq, "John");
	 * const data = expr.toJSON();
	 * // { key: "name", operator: "eq", value: "John" }
	 * ```
	 */
	toJSON(): ExpressionContext {
		return {
			key: this.key,
			operator: this.operator,
			value: this.value,
		};
	}

	/**
	 * Renders the expression as a string.
	 *
	 * Uses the configured renderers to format the key, operator, and value.
	 * If a custom `renderExpression` function is provided and returns a truthy
	 * value, that value is used directly. Otherwise, the individual renderers
	 * are applied.
	 *
	 * @param options - Optional rendering options that override instance options.
	 * @returns The rendered string representation of the expression.
	 *
	 * @example
	 * ```ts
	 * const expr = new Expression("age", OPERATOR.gte, 18);
	 * expr.toString(); // "age>=18"
	 *
	 * // With custom renderers
	 * expr.toString({
	 *   renderKey: (ctx) => `"${ctx.key}"`,
	 *   renderValue: (ctx) => `'${ctx.value}'`
	 * }); // '"age">=\'18\''
	 * ```
	 */
	toString(options: Partial<ExpressionRenderersOptions> = {}): string {
		let { renderKey, renderOperator, renderValue, renderExpression } = {
			...(this.options || {}),
			...(options || {}),
		};

		const ctx = this.toJSON();

		// renderExpression is considered higher priority
		if (typeof renderExpression === "function") {
			const rendered = renderExpression(ctx);
			// if truthy, return early
			if (rendered) return rendered;
		}

		// fallback to defaults if options are not provided
		renderKey ??= ({ key }) => `${key}`;
		renderOperator ??= ({ operator }) =>
			(OPERATOR_SYMBOL as any)[`${operator}`] || `${operator}`;
		renderValue ??= ({ value }) => `${value}`;

		//
		return [renderKey(ctx), renderOperator(ctx), renderValue(ctx)].join("");
	}
}
