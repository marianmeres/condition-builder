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

export class Expression {
	constructor(
		public key: string,
		public operator: ExpressionOperator,
		public value: any,
		public options: Partial<{
			// custom renderers support
			renderKey: (key: string) => string;
			renderValue: (value: any) => string;
			renderOperator: (operator: ExpressionOperator) => string;
		}> = {}
	) {}

	static renderKey(key: string) {
		return key;
	}

	static renderValue(value: any) {
		const q = "'";
		return q + value.toString().replace(q, q + q) + q; // pg dialect
	}

	static renderOperator(operator: ExpressionOperator) {
		return OPERATOR_SYMBOL[operator] || OPERATOR_SYMBOL.eq;
	}

	protected _render(name: "key" | "value" | "operator", value: any) {
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
		return (_instance[name] ?? _static[name])?.(value);
	}

	toJSON() {
		return {
			key: this.key,
			operator: this.operator,
			value: this.value,
		};
	}

	toString() {
		return [
			this._render("key", this.key),
			this._render("operator", this.operator),
			this._render("value", this.value),
		].join("");
	}
}
