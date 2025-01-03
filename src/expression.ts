// deno-lint-ignore-file no-explicit-any

/**
 * Map of supported operators.
 * Inspired from: https://docs.postgrest.org/en/v12/references/api/tables_views.html
 * */
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
	ltree: "ltree",
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
	in: "@>",
	nin: "!@>",
	ltree: "~", // https://www.postgresql.org/docs/17/ltree.html
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

/** Function to render expression data items. */
export type Renderer = (context: ExpressionContext) => string;

/** Expression options used for validation and rendering. */
export interface ExpressionOptions {
	/** Function used to validate expression data. No-op by default. */
	validate?: Validator;
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

	/** Returns internal representation as POJO. */
	toJSON(): ExpressionContext {
		return {
			key: this.key,
			operator: this.operator,
			value: this.value,
		};
	}

	/** Return internal representation as final textual outcome. */
	toString(): string {
		let { renderKey, renderOperator, renderValue } = this.options || {};

		// fallback to defaults if options are not provided
		renderKey ??= ({ key }) => `${key}`;
		renderOperator ??= ({ operator }) =>
			(OPERATOR_SYMBOL as any)[`${operator}`] || `${operator}`;
		renderValue ??= ({ value }) => `${value}`;

		const c = this.toJSON();
		return [renderKey(c), renderOperator(c), renderValue(c)].join("");
	}
}
