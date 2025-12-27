/**
 * Condition building utilities for creating hierarchical logical structures.
 *
 * This module provides the {@linkcode Condition} class for building complex,
 * nested logical conditions by combining multiple {@linkcode Expression}s
 * with logical operators (AND, OR, AND NOT, OR NOT).
 *
 * @example
 * ```ts
 * import { Condition, OPERATOR } from "@marianmeres/condition-builder";
 *
 * const cond = new Condition()
 *   .and("status", OPERATOR.eq, "active")
 *   .and("age", OPERATOR.gte, 18)
 *   .or(new Condition()
 *     .and("role", OPERATOR.eq, "admin")
 *   );
 *
 * console.log(cond.toString());
 * // "status=active and age>=18 or (role=admin)"
 * ```
 *
 * @module
 */

import {
	Expression,
	type ExpressionRenderersOptions,
	type ExpressionContext,
	type ExpressionOperator,
	type ExpressionOptions,
} from "./expression.ts";

/**
 * Operator used to logically combine conditions.
 *
 * Supported operators are `and`, `or`, `andNot`, and `orNot`.
 */
export type ConditionJoinOperator = "and" | "or" | "andNot" | "orNot";

/** Internal representation type. */
export type ConditionContent = {
	operator: ConditionJoinOperator;
	condition: Condition | undefined;
	expression: Expression | undefined;
}[];

/**
 * Serializable representation of a condition as a plain object.
 *
 * This type is used for serialization/deserialization via {@linkcode Condition.toJSON}
 * and {@linkcode Condition.restore}.
 */
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

	#and(
		joinOperation: "and" | "andNot",
		keyOrCond: string | Condition,
		operator?: ExpressionOperator,
		value?: any
	): Condition {
		return keyOrCond instanceof Condition
			? this.#addCondition(keyOrCond, joinOperation)
			: this.#addExpression(keyOrCond, operator!, value, joinOperation);
	}

	#or(
		joinOperation: "or" | "orNot",
		keyOrCond: string | Condition,
		operator?: ExpressionOperator,
		value?: any
	): Condition {
		return keyOrCond instanceof Condition
			? this.#addCondition(keyOrCond, joinOperation)
			: this.#addExpression(keyOrCond, operator!, value, joinOperation);
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
		return this.#and("and", keyOrCond, operator, value);
	}

	/** Adds data as a new `Expression` as an _and not_ logical block. */
	andNot(key: string, operator: ExpressionOperator, value: any): Condition;

	/** Adds `Condition` as an _and not_ logical block. */
	andNot(condition: Condition): Condition;

	/** Adds `Condition` or `Expression` data as an _and not_ logical block. */
	andNot(
		keyOrCond: string | Condition,
		operator?: ExpressionOperator,
		value?: any
	): Condition {
		return this.#and("andNot", keyOrCond, operator, value);
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
		return this.#or("or", keyOrCond, operator, value);
	}

	/** Adds data as a new `Expression` as an _or not_ logical block. */
	orNot(key: string, operator: ExpressionOperator, value: any): Condition;

	/** Adds `Condition` as an _or not_ logical block. */
	orNot(condition: Condition): Condition;

	/** Adds `Condition` or `Expression` data as an _or not_ logical block. */
	orNot(
		keyOrCond: string | Condition,
		operator?: ExpressionOperator,
		value?: any
	): Condition {
		return this.#or("orNot", keyOrCond, operator, value);
	}

	/**
	 * Returns the condition data as a plain object.
	 *
	 * This creates a deep clone of the internal structure that can be
	 * safely serialized to JSON.
	 *
	 * @returns A plain object representation of the condition.
	 *
	 * @example
	 * ```ts
	 * const cond = new Condition().and("a", OPERATOR.eq, "b");
	 * const data = cond.toJSON();
	 * // [{ operator: "and", expression: { key: "a", operator: "eq", value: "b" } }]
	 * ```
	 */
	toJSON(): ConditionDump {
		return JSON.parse(JSON.stringify(this.#content)); // quick-n-dirty
	}

	/**
	 * Returns the condition as a JSON string.
	 *
	 * This is a convenience method equivalent to `JSON.stringify(condition.toJSON())`.
	 *
	 * @returns A JSON string representation of the condition.
	 *
	 * @example
	 * ```ts
	 * const cond = new Condition().and("a", OPERATOR.eq, "b");
	 * const json = cond.dump();
	 * // Store in database, send over network, etc.
	 * ```
	 */
	dump(): string {
		return JSON.stringify(this.#content);
	}

	/**
	 * Creates a new Condition instance from a serialized dump.
	 *
	 * This is the inverse of {@linkcode dump} and {@linkcode toJSON}.
	 * Useful for restoring conditions that were stored or transmitted.
	 *
	 * @param dump - A JSON string or plain object representing the condition.
	 * @param options - Optional expression options to apply during restoration.
	 * @returns A new Condition instance with the restored structure.
	 * @throws {TypeError} If the dump contains invalid data.
	 *
	 * @example
	 * ```ts
	 * const original = new Condition().and("a", OPERATOR.eq, "b");
	 * const json = original.dump();
	 *
	 * // Later, restore from JSON
	 * const restored = Condition.restore(json);
	 * restored.toString(); // "a=b"
	 * ```
	 */
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
			const method: "and" | "or" | "andNot" | "orNot" =
				content[Math.max(i - 1, 0)].operator;

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

	/**
	 * Renders the condition as a string.
	 *
	 * Recursively processes all nested conditions and expressions,
	 * joining them with appropriate logical operators.
	 *
	 * @param options - Optional rendering options that override instance options.
	 * @returns The rendered string representation of the condition.
	 *
	 * @example
	 * ```ts
	 * const cond = new Condition()
	 *   .and("a", OPERATOR.eq, "b")
	 *   .or("c", OPERATOR.neq, "d");
	 *
	 * cond.toString(); // "a=b or c!=d"
	 *
	 * // With custom renderers for PostgreSQL
	 * cond.toString({
	 *   renderKey: (ctx) => `"${ctx.key}"`,
	 *   renderValue: (ctx) => `'${ctx.value}'`
	 * }); // '"a"=\'b\' or "c"!=\'d\''
	 * ```
	 */
	toString(options: Partial<ExpressionRenderersOptions> = {}): string {
		if (!this.#content.length) return "";
		const operatorsMap = {
			and: "and",
			andNot: "and not",
			or: "or",
			orNot: "or not",
		};
		return (
			this.#content
				.reduce((m, o) => {
					if (!o.condition && !o.expression) return m;
					const val = o.condition
						? `(${o.condition.toString(options)})`
						: o.expression!.toString(options);
					if (val !== "()") {
						m.push(
							o.condition
								? `(${o.condition.toString(options)})`
								: o.expression!.toString(options),
							operatorsMap[o.operator]
						);
					}
					return m;
				}, [] as string[])
				// strip last block operator
				.slice(0, -1)
				.join(" ")
		);
	}
}
