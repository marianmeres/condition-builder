// deno-lint-ignore-file no-explicit-any

import { Expression, ExpressionOperator } from "./expression.ts";

export type GroupOperator = "and" | "or";

export class Group {
	#content: {
		operator: GroupOperator;
		group: Group | undefined;
		expression: Expression | undefined;
	}[] = [];

	constructor(
		public operator: GroupOperator = "and",
		public options: Partial<{
			expression: Partial<{
				renderKey: (key: string) => string;
				renderValue: (value: any) => string;
				renderOperator: (operator: ExpressionOperator) => string;
			}>;
		}> = {}
	) {}

	#setPreviousAs(operator: GroupOperator) {
		const previous = this.#content[this.#content.length - 1];
		if (previous) previous.operator = operator;
	}

	#addExpression(
		key: string,
		operator: ExpressionOperator,
		value: any,
		groupOperator: GroupOperator
	): Group {
		this.#setPreviousAs(groupOperator);
		this.#content.push({
			group: undefined,
			operator: groupOperator,
			expression: new Expression(key, operator, value, this.options.expression),
		});
		return this;
	}

	#addGroup(group: Group, operator: GroupOperator): Group {
		this.#setPreviousAs(operator);
		group.options.expression = this.options.expression;
		this.#content.push({ group, operator, expression: undefined });
		return this;
	}

	and(key: string, operator: ExpressionOperator, value: any): Group;
	and(group: Group): Group;
	and(
		keyOrGroup: string | Group,
		operator?: ExpressionOperator,
		value?: any
	): Group {
		return keyOrGroup instanceof Group
			? this.#addGroup(keyOrGroup, "and")
			: this.#addExpression(keyOrGroup, operator!, value, "and");
	}

	or(key: string, operator: ExpressionOperator, value: any): Group;
	or(group: Group): Group;
	or(
		keyOrGroup: string | Group,
		operator?: ExpressionOperator,
		value?: any
	): Group {
		return keyOrGroup instanceof Group
			? this.#addGroup(keyOrGroup, "or")
			: this.#addExpression(keyOrGroup, operator!, value, "or");
	}

	toJSON() {
		// return JSON.parse(JSON.stringify(this.#content));
		return this.#content
			.reduce((m, o) => {
				if (!o.group && !o.expression) return m;
				m.push(o.group ? o.group.toJSON() : o.expression!.toJSON(), o.operator);
				return m;
			}, [] as any[])
			.slice(0, -1);
	}

	toString() {
		if (!this.#content.length) return "";
		const out = this.#content.reduce((m, o) => {
			if (!o.group && !o.expression) return m;
			m.push(
				o.group ? `(${o.group.toString()})` : o.expression!.toString(),
				o.operator
			);
			return m;
		}, [] as any[]);

		// remove trailing operator
		return out.slice(0, -1).join(" ");
	}
}
