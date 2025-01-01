// deno-lint-ignore-file no-explicit-any

// inspiration: https://docs.postgrest.org/en/v12/references/api/tables_views.html
export const OPERATOR = {
	eq: "eq",
	not_eq: "not_eq",
	gt: "gt",
	gte: "gte",
	lt: "lt",
	lte: "lte",
	match: "match",
	not_match: "not_match",
	in: "in",
	not_in: "not_in",
} as const;

//
export const OPERATOR_SYMBOL: Record<keyof typeof OPERATOR, string> = {
	eq: "=",
	not_eq: "!=",
	gt: ">",
	gte: ">=",
	lt: "<",
	lte: "<=",
	match: "~",
	not_match: "!~",
	in: "@>",
	not_in: "!@>",
} as const;

//
export type ExpressionOperator = keyof typeof OPERATOR;

//
export interface RenderContext {
	key: string;
	operator: ExpressionOperator;
	value: any;
}

export type Renderer = (context: RenderContext) => string;

//
export class Expression {
	constructor(
		public key: string,
		public operator: ExpressionOperator,
		public value: any,
		public options: Partial<{
			// custom renderers support
			renderKey: Renderer;
			renderValue: Renderer;
			renderOperator: Renderer;
		}> = {}
	) {}

	static renderKey(context: RenderContext) {
		return context.key;
	}

	static renderValue(context: RenderContext) {
		const q = "'";
		return q + context.value.toString().replace(q, q + q) + q; // pg dialect
	}

	static renderOperator(context: RenderContext) {
		return OPERATOR_SYMBOL[context.operator] || OPERATOR_SYMBOL.eq;
	}

	protected _render(
		name: "key" | "value" | "operator",
		context: RenderContext
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

	toJSON() {
		return {
			key: this.key,
			operator: this.operator,
			value: this.value,
		};
	}

	toString(): string {
		const context: RenderContext = {
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
