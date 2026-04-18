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

/**
 * Internal representation type.
 *
 * Invariant: `content[i].operator` is the join operator between `content[i]`
 * and `content[i+1]` (i.e. the operator *following* this entry). The operator
 * on the last entry is a placeholder from when it was appended and is unused
 * at render time.
 */
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

/** Merge helper: `overrides` wins per-key, but `undefined` values are ignored. */
function mergeRenderOptions(
	base: Partial<ExpressionRenderersOptions> | undefined,
	overrides: Partial<ExpressionRenderersOptions> | undefined
): Partial<ExpressionRenderersOptions> {
	const out: any = { ...(base ?? {}) };
	if (overrides) {
		for (const k of Object.keys(overrides) as (keyof ExpressionRenderersOptions)[]) {
			const v = (overrides as any)[k];
			if (v !== undefined) out[k] = v;
		}
	}
	return out;
}

/** Precedence level of a join operator. AND binds tighter than OR. */
function joinLevel(op: ConditionJoinOperator): number {
	return op.startsWith("and") ? 2 : 1;
}

/** High level class to represent `Expression`s as logical structure. */
export class Condition {
	#content: ConditionContent = [];

	constructor(public options: ExpressionOptions = {}) {}

	#setCurrentAs(operator: ConditionJoinOperator) {
		if (this.#content.length) {
			const current = this.#content.at(-1);
			if (current) current.operator = operator;
		}
	}

	#addExpression(
		key: string,
		operator: ExpressionOperator,
		value: any,
		condOperator: ConditionJoinOperator
	): Condition {
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
		// Do NOT mutate the sub-condition's `options`. Each node keeps its own
		// options (and therefore its own validator); render-time options
		// propagate down from ancestors via `toString()`.
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
	 * Returns `true` if this condition contains no non-empty expressions or
	 * sub-conditions (recursively). An empty condition renders to the empty
	 * string and contributes nothing to a parent's output.
	 */
	isEmpty(): boolean {
		for (const o of this.#content) {
			if (o.expression) return false;
			if (o.condition && !o.condition.isEmpty()) return false;
		}
		return true;
	}

	/**
	 * Returns the condition data as a plain object.
	 *
	 * This creates a deep clone of the internal structure that can be
	 * safely serialized to JSON.
	 *
	 * Note: serialization uses `JSON.parse(JSON.stringify(...))`, so value
	 * types that aren't representable in JSON (BigInt, Date, Map, functions,
	 * Symbol, `undefined`) are not preserved round-trip. If you need to
	 * persist such values, pre-transform them into JSON-safe primitives.
	 *
	 * @returns A plain object representation of the condition.
	 */
	toJSON(): ConditionDump {
		return JSON.parse(JSON.stringify(this.#content)); // quick-n-dirty
	}

	/**
	 * Returns the condition as a JSON string.
	 *
	 * Convenience method equivalent to `JSON.stringify(condition.toJSON())`.
	 *
	 * See {@linkcode toJSON} for notes on value-type limitations.
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

			// The "and(...)", "or(...)" apis always update the current (preceding)
			// operator before adding the new entry, so to round-trip we replay the
			// call using the *previous* entry's stored operator (the last-entry
			// operator is a placeholder and unused at render time).
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
				cond[method](key, operator, value);
			}
		}

		return cond;
	}

	/**
	 * Renders the condition as a string.
	 *
	 * Recursively processes all nested conditions and expressions, joining
	 * them with the appropriate logical operators. SQL operator precedence
	 * is preserved: because `AND` binds tighter than `OR`, the output is
	 * auto-parenthesized so that chains built left-associatively via the
	 * builder API evaluate the way they read.
	 *
	 * Example: `.and("a", eq, 1).or("b", eq, 2).and("c", eq, 3)` renders as
	 * `(a=1 or b=2) and c=3`, not `a=1 or b=2 and c=3` (which SQL would
	 * parse as `a=1 or (b=2 and c=3)`).
	 *
	 * @param options - Optional rendering options. Any defined keys override
	 *                  the instance's own options and propagate to nested
	 *                  conditions and expressions. Keys whose value is
	 *                  `undefined` are ignored (they do NOT erase the
	 *                  instance-configured renderer).
	 * @returns The rendered string representation of the condition.
	 */
	toString(options: Partial<ExpressionRenderersOptions> = {}): string {
		if (!this.#content.length) return "";

		// Propagate: this node's own options serve as defaults, caller's
		// options as overrides (undefined values are ignored).
		const effective = mergeRenderOptions(this.options, options);

		const operatorsMap: Record<ConditionJoinOperator, string> = {
			and: "and",
			andNot: "and not",
			or: "or",
			orNot: "or not",
		};

		type Term = { rendered: string; join: ConditionJoinOperator | null };
		const terms: Term[] = [];
		let lastSurvivingIdx = -1;

		for (let i = 0; i < this.#content.length; i++) {
			const o = this.#content[i];
			let rendered: string | null = null;

			if (o.condition) {
				if (!o.condition.isEmpty()) {
					rendered = `(${o.condition.toString(effective)})`;
				}
			} else if (o.expression) {
				rendered = o.expression.toString(effective);
			}

			if (rendered === null) continue;

			// Connector between this surviving term and the previous surviving
			// term is the operator stored on the previous *surviving* entry
			// (content[i].operator is the connector that follows content[i]).
			const join =
				lastSurvivingIdx === -1
					? null
					: this.#content[lastSurvivingIdx].operator;
			terms.push({ rendered, join });
			lastSurvivingIdx = i;
		}

		if (terms.length === 0) return "";
		if (terms.length === 1) return terms[0].rendered;

		// Left-associative render with auto-parenthesization to preserve
		// precedence (AND binds tighter than OR in SQL).
		let acc = terms[0].rendered;
		let accLevel = Infinity; // atoms have highest precedence
		for (let i = 1; i < terms.length; i++) {
			const { rendered, join } = terms[i];
			const opLevel = joinLevel(join!);
			if (opLevel > accLevel) acc = `(${acc})`;
			acc = `${acc} ${operatorsMap[join!]} ${rendered}`;
			accLevel = opLevel;
		}
		return acc;
	}
}
