// deno-lint-ignore-file no-explicit-any

import {
	Expression,
	type ExpressionContext,
	type ExpressionOperator,
	type Renderer,
	type Validator,
} from "./expression.ts";

/** Operator used to logically combine conditions. Supported are `and` and `or`.*/
export type ConditionJoinOperator = "and" | "or";

/** Internal representation type. */
export type ConditionContent = {
	operator: ConditionJoinOperator;
	condition: Condition | undefined;
	expression: Expression | undefined;
}[];

/** Internal represendation as POJO. */
export type ConditionDump = {
	operator: ConditionJoinOperator;
	condition: ConditionDump | undefined;
	expression: ExpressionContext | undefined;
}[];

/** High level class to represent `Expression`s as logical structure. */
export class Condition {
	#content: ConditionContent = [];

	constructor(
		public options: Partial<{
			validate: Validator;
			renderKey: Renderer;
			renderValue: Renderer;
			renderOperator: Renderer;
		}> = {}
	) {}

	#setPreviousAs(operator: ConditionJoinOperator) {
		const previous = this.#content[this.#content.length - 1];
		if (previous) previous.operator = operator;
	}

	#addExpression(
		key: string,
		operator: ExpressionOperator,
		value: any,
		condOperator: ConditionJoinOperator
	): Condition {
		this.#setPreviousAs(condOperator);
		this.#content.push({
			condition: undefined,
			operator: condOperator,
			expression: new Expression(key, operator, value, this.options),
		});
		return this;
	}

	#addCondition(
		condition: Condition,
		operator: ConditionJoinOperator
	): Condition {
		this.#setPreviousAs(operator);
		condition.options = this.options;
		this.#content.push({ condition, operator, expression: undefined });
		return this;
	}

	/** Adds data as a new `Expression` as an _and_ logical block. */
	and(key: string, operator: ExpressionOperator, value: any): Condition;

	/** Adds `Condition` as an _and_ logical block. */
	and(condition: Condition): Condition;

	/** Adds `Condition` or `Expression` data as an _and_ logical block. */
	and(
		keyOrCond: string | Condition,
		operator?: ExpressionOperator,
		value?: any
	): Condition {
		return keyOrCond instanceof Condition
			? this.#addCondition(keyOrCond, "and")
			: this.#addExpression(keyOrCond, operator!, value, "and");
	}

	/** Adds data as a new `Expression` as an _or_ logical block. */
	or(key: string, operator: ExpressionOperator, value: any): Condition;

	/** Adds `Condition` as an _or_ logical block. */
	or(condition: Condition): Condition;

	/** Adds `Condition` or `Expression` data as an _or_ logical block. */
	or(
		keyOrCond: string | Condition,
		operator?: ExpressionOperator,
		value?: any
	): Condition {
		return keyOrCond instanceof Condition
			? this.#addCondition(keyOrCond, "or")
			: this.#addExpression(keyOrCond, operator!, value, "or");
	}

	/** Sets logical block separator by index position. Used internally in `restore`. */
	setOperator(index: number, operator: ConditionJoinOperator): Condition {
		if (this.#content[index]) {
			this.#content[index].operator = operator;
		} else {
			throw new Error(`Index '${index}' not found`);
		}
		return this;
	}

	/** Returns internal representation as POJO. */
	toJSON(): ConditionDump {
		return JSON.parse(JSON.stringify(this.#content)); // quick-n-dirty
	}

	/** Returns internal representation as stringified POJO. */
	dump(): string {
		return JSON.stringify(this.#content);
	}

	/** Creates new instance from dump (POJO). Oposite of `dump`. */
	static restore(dump: string | ConditionDump): Condition {
		const cond = new Condition();
		const content: ConditionDump =
			typeof dump === "string" ? JSON.parse(dump) : dump;

		for (const expOrCond of content) {
			if (!expOrCond?.condition && !expOrCond?.expression) {
				throw new TypeError("Neither 'condition' nor 'expression' found");
			}
			const method: "and" | "or" = expOrCond.operator;
			if (expOrCond?.condition) {
				const backup = expOrCond.condition[0].operator;
				const restored = Condition.restore(JSON.stringify(expOrCond.condition));
				restored.setOperator(0, backup);
				cond[method](restored);
			} else {
				const { key, operator, value } = expOrCond?.expression!;
				cond[method](key, operator, value);
			}
		}

		return cond;
	}

	/** Return internal representation as final textual outcome. */
	toString(): string {
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
				}, [] as string[])
				// strip last block operator
				.slice(0, -1)
				.join(" ")
		);
	}
}
