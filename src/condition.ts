// deno-lint-ignore-file no-explicit-any

import {
	Expression,
	type ExpressionRenderersOptions,
	type ExpressionContext,
	type ExpressionOperator,
	type ExpressionOptions,
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
	condition?: ConditionDump | undefined;
	expression: ExpressionContext | undefined;
}[];

/** High level class to represent `Expression`s as logical structure. */
export class Condition {
	#content: ConditionContent = [];

	constructor(public options: ExpressionOptions = {}) {}

	#setCurrentAs(operator: ConditionJoinOperator) {
		if (this.#content.length) {
			const current = this.#content.at(-1);
			if (current) {
				// console.log("setCurrentAs", current.operator, operator);
				current.operator = operator;
			}
		}
	}

	#addExpression(
		key: string,
		operator: ExpressionOperator,
		value: any,
		condOperator: ConditionJoinOperator
	): Condition {
		// console.log("addExpression", condOperator, key, operator, value);
		this.#setCurrentAs(condOperator);
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
		this.#setCurrentAs(operator);
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

	/** Returns internal representation as POJO. */
	toJSON(): ConditionDump {
		return JSON.parse(JSON.stringify(this.#content)); // quick-n-dirty
	}

	/** Returns internal representation as stringified POJO. */
	dump(): string {
		return JSON.stringify(this.#content);
	}

	/** Creates new instance from dump (POJO). Oposite of `dump`. */
	static restore(
		dump: string | ConditionDump,
		options: ExpressionOptions = {}
	): Condition {
		const cond = new Condition(options);
		const content: ConditionDump =
			typeof dump === "string" ? JSON.parse(dump) : dump;

		for (const [i, expOrCond] of content.entries()) {
			if (!expOrCond?.condition && !expOrCond?.expression) {
				throw new TypeError("Neither 'condition' nor 'expression' found");
			}

			// this is a little tricky - we need to use previous (unless we're at 0)
			// because the "and(...)", "or(...)" apis always update the current operator
			// before adding the new one
			const method: "and" | "or" = content[Math.max(i - 1, 0)].operator;

			if (expOrCond?.condition) {
				const restored = Condition.restore(
					JSON.stringify(expOrCond.condition),
					options
				);
				cond[method](restored);
			} else {
				const { key, operator, value } = expOrCond?.expression!;
				// console.log(method, key, operator, value);
				cond[method](key, operator, value);
			}
		}

		return cond;
	}

	/** Return internal representation as final textual outcome. */
	toString(options: Partial<ExpressionRenderersOptions> = {}): string {
		if (!this.#content.length) return "";
		return (
			this.#content
				.reduce((m, o) => {
					if (!o.condition && !o.expression) return m;
					m.push(
						o.condition
							? `(${o.condition.toString(options)})`
							: o.expression!.toString(options),
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
