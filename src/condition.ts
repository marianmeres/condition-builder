// deno-lint-ignore-file no-explicit-any

import {
	Expression,
	type Renderer,
	type ExpressionOperator,
} from "./expression.ts";

export type ConditionOperator = "and" | "or";

export class Condition {
	#content: {
		operator: ConditionOperator;
		condition: Condition | undefined;
		expression: Expression | undefined;
	}[] = [];

	constructor(
		public options: Partial<{
			expression: Partial<{
				renderKey: Renderer;
				renderValue: Renderer;
				renderOperator: Renderer;
			}>;
		}> = {}
	) {}

	#setPreviousAs(operator: ConditionOperator) {
		const previous = this.#content[this.#content.length - 1];
		if (previous) previous.operator = operator;
	}

	#addExpression(
		key: string,
		operator: ExpressionOperator,
		value: any,
		condOperator: ConditionOperator
	): Condition {
		this.#setPreviousAs(condOperator);
		this.#content.push({
			condition: undefined,
			operator: condOperator,
			expression: new Expression(key, operator, value, this.options.expression),
		});
		return this;
	}

	#addCondition(condition: Condition, operator: ConditionOperator): Condition {
		this.#setPreviousAs(operator);
		condition.options.expression = this.options.expression;
		this.#content.push({ condition, operator, expression: undefined });
		return this;
	}

	and(key: string, operator: ExpressionOperator, value: any): Condition;
	and(condition: Condition): Condition;
	and(
		keyOrCond: string | Condition,
		operator?: ExpressionOperator,
		value?: any
	): Condition {
		return keyOrCond instanceof Condition
			? this.#addCondition(keyOrCond, "and")
			: this.#addExpression(keyOrCond, operator!, value, "and");
	}

	or(key: string, operator: ExpressionOperator, value: any): Condition;
	or(condition: Condition): Condition;
	or(
		keyOrCond: string | Condition,
		operator?: ExpressionOperator,
		value?: any
	): Condition {
		return keyOrCond instanceof Condition
			? this.#addCondition(keyOrCond, "or")
			: this.#addExpression(keyOrCond, operator!, value, "or");
	}

	toJSON() {
		// return JSON.parse(JSON.stringify(this.#content));
		return this.#content
			.reduce((m, o) => {
				if (!o.condition && !o.expression) return m;
				m.push(
					o.condition ? o.condition.toJSON() : o.expression!.toJSON(),
					o.operator
				);
				return m;
			}, [] as any[])
			.slice(0, -1);
	}

	toString() {
		if (!this.#content.length) return "";
		return (
			this.#content
				.reduce((m, o) => {
					if (!o.condition && !o.expression) return m;
					m.push(
						o.condition
							? `(${o.condition.toString()})`
							: o.expression!.toString(),
						o.operator
					);
					return m;
				}, [] as any[])
				// remove trailing operator
				.slice(0, -1)
				.join(" ")
		);
	}
}
