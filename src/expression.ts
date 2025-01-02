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
	match: "match",
	nmatch: "nmatch", // not match
	in: "in",
	nin: "nin", // not in
} as const;

/** Conversion map of operators to operator symbols. Used internally mostly.  */
export const OPERATOR_SYMBOL: Record<keyof typeof OPERATOR, string> = {
	eq: "=",
	neq: "!=",
	gt: ">",
	gte: ">=",
	lt: "<",
	lte: "<=",
	match: "~",
	nmatch: "!~",
	in: "@>",
	nin: "!@>",
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
		public options: Partial<{
			validate: Validator;
			// custom renderers support
			renderKey: Renderer;
			renderValue: Renderer;
			renderOperator: Renderer;
		}> = {}
	) {
		const _validate = options?.validate ?? Expression.validate;
		_validate?.({ key: this.key, operator: this.operator, value: this.value });
	}

	/** Function used to validate expression data. No-op by default. */
	static validate(context: ExpressionContext): void {
		// no-op by default... all is valid
	}

	/**
	 * Function used to convert expression key to string. No-op by default.
	 * @example For postgresql dialect
	 * ```ts
	 * Expression.renderKey = (context: ExpressionContext): string => {
	 * return `"${context.key.toString().replaceAll('"', '""')}"`;
	 * }
	 * ```
	 */
	static renderKey(context: ExpressionContext): string {
		return context.key;
	}

	/**
	 * Function used to convert expression value to string. No-op by default.
	 * @example For postgresql dialect
	 * ```ts
	 * Expression.renderValue = (context: ExpressionContext): string => {
	 * return `'${context.key.toString().replaceAll("'", "''")}'`;
	 * }
	 * ```
	 */
	static renderValue(context: ExpressionContext): string {
		return context.value;
	}

	/**
	 * Function used to convert expression operator to string.
	 */
	static renderOperator(context: ExpressionContext): string {
		return (OPERATOR_SYMBOL as any)[context.operator] || context.operator;
	}

	protected _render(
		name: "key" | "value" | "operator",
		context: ExpressionContext
	): string {
		const _static = {
			key: Expression.renderKey,
			value: Expression.renderValue,
			operator: Expression.renderOperator,
		};
		const _instance = {
			key: this.options.renderKey,
			value: this.options.renderValue,
			operator: this.options.renderOperator,
		};
		return (_instance[name] ?? _static[name])?.(context);
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
		const context: ExpressionContext = {
			key: this.key,
			operator: this.operator,
			value: this.value,
		};
		return [
			this._render("key", context),
			this._render("operator", context),
			this._render("value", context),
		].join("");
	}
}
