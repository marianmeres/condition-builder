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

/**
 * Operators whose values are treated as lists (array values are rendered
 * as a parenthesized, comma-separated group).
 */
export const LIST_OPERATORS: ReadonlySet<string> = new Set([
	OPERATOR.in,
	OPERATOR.nin,
]);

/**
 * Key of `OPERATOR`, or any custom operator string.
 *
 * The `(string & {})` trick keeps editor autocomplete for the built-in keys
 * while still allowing arbitrary string operators.
 */
export type ExpressionOperator = keyof typeof OPERATOR | (string & {});

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
 * Returns a string if rendering should be applied (including an empty string,
 * which is honored as "render nothing"), or `null` / `undefined` / `false` /
 * `void` to fall back to the default per-part rendering.
 *
 * @param context - The expression context containing key, operator, and value.
 * @returns The rendered string, or a non-string falsy value to fall back to
 *          default rendering.
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
	 *
	 * For list-operator values (`in`, `nin`) passed as arrays, this renderer
	 * is invoked once per element (with the element substituted into
	 * `context.value`), and the results are wrapped in parentheses and
	 * comma-joined.
	 *
	 * @example For postgresql dialect
	 * ```ts
	 * (context: ExpressionContext): string => {
	 * return `'${String(context.value).replaceAll("'", "''")}'`;
	 * }
	 * ```
	 */
	renderValue?: Renderer;
	/**
	 * Function used to convert expression operator to string.
	 */
	renderOperator?: Renderer;
	/** Function to render expression to string. If provided, will be used with
	 * higher priority than individual renderers. A returned string (including
	 * an empty string) is honored; only `null` / `undefined` / `false` / `void`
	 * falls back to the normal render flow (key, operator, value).
	 */
	renderExpression?: RendererMaybe;
}

/** Expression options used for validation and rendering. */
export interface ExpressionOptions extends ExpressionRenderersOptions {
	/** Function used to validate expression data. No-op by default. */
	validate?: Validator;
}

/**
 * Merge two option objects so that `overrides` wins per-key, but only for
 * keys whose value is explicitly defined (not `undefined`). This prevents
 * `{ renderValue: undefined }` from erasing an instance-configured renderer.
 */
function mergeOptions<T extends object>(base: T, overrides: Partial<T>): T {
	const out: any = { ...(base ?? {}) };
	for (const k of Object.keys(overrides) as (keyof T)[]) {
		const v = (overrides as any)[k];
		if (v !== undefined) out[k] = v;
	}
	return out;
}

/** @internal */
export const __mergeOptionsForTests = mergeOptions;

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
	 * If a custom `renderExpression` function is provided and returns a string
	 * (including an empty string), that value is used directly. Otherwise,
	 * the individual renderers are applied.
	 *
	 * Array values are rendered as parenthesized comma-separated lists when
	 * the operator is in {@linkcode LIST_OPERATORS} (`in`, `nin`), with each
	 * element passed through `renderValue` individually.
	 *
	 * @param options - Optional rendering options that override instance
	 *                  options. Keys whose value is `undefined` are ignored
	 *                  (they do NOT erase the instance-configured renderer).
	 * @returns The rendered string representation of the expression.
	 */
	toString(options: Partial<ExpressionRenderersOptions> = {}): string {
		const {
			renderKey,
			renderOperator,
			renderValue,
			renderExpression,
		} = mergeOptions<ExpressionRenderersOptions>(this.options ?? {}, options);

		const ctx = this.toJSON();

		if (typeof renderExpression === "function") {
			const rendered = renderExpression(ctx);
			// honor any string return, including ""
			if (typeof rendered === "string") return rendered;
		}

		const rKey = renderKey ?? (({ key }) => `${key}`);
		const rOp =
			renderOperator ??
			(({ operator }) =>
				(OPERATOR_SYMBOL as any)[`${operator}`] || `${operator}`);
		const rVal = renderValue ?? (({ value }) => `${value}`);

		const valueStr =
			Array.isArray(ctx.value) && LIST_OPERATORS.has(`${ctx.operator}`)
				? "(" +
					ctx.value.map((v) => rVal({ ...ctx, value: v })).join(",") +
					")"
				: rVal(ctx);

		return `${rKey(ctx)}${rOp(ctx)}${valueStr}`;
	}
}
