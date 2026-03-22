import { z } from "npm:zod";
import type { McpToolDefinition } from "jsr:@marianmeres/mcp-server/types";
import { Condition } from "./src/mod.ts";

interface ConditionNode {
	join?: "and" | "or" | "andNot" | "orNot";
	key?: string;
	operator?: string;
	value?: unknown;
	children?: ConditionNode[];
}

function buildCondition(nodes: ConditionNode[]): Condition {
	const condition = new Condition();
	for (const node of nodes) {
		const joinOp = node.join ?? "and";
		if (node.children) {
			const nested = buildCondition(node.children);
			condition[joinOp](nested);
		} else if (node.key && node.operator) {
			condition[joinOp](node.key, node.operator, node.value);
		}
	}
	return condition;
}

export const tools: McpToolDefinition[] = [
	{
		name: "build-condition",
		description:
			"Build a SQL WHERE clause from a structured JSON description of conditions with nested AND/OR/NOT logic. Uses PostgreSQL operator symbols by default.",
		params: {
			conditions: z
				.string()
				.describe(
					'JSON array of condition nodes. Each node: { "join": "and"|"or"|"andNot"|"orNot", "key": "column", "operator": "eq"|"neq"|"gt"|"gte"|"lt"|"lte"|"like"|"nlike"|"match"|"nmatch"|"is"|"nis"|"in"|"nin", "value": "..." } for leaf expressions, or { "join": "...", "children": [...] } for nested groups. The "join" of the first node is ignored.'
				),
		},
		handler: async ({ conditions }) => {
			const nodes: ConditionNode[] = JSON.parse(conditions as string);
			return buildCondition(nodes).toString();
		},
	},
	{
		name: "render-condition-dump",
		description:
			"Render a serialized condition-builder dump (from Condition.dump()) back to a human-readable SQL WHERE clause string.",
		params: {
			dump: z.string().describe("JSON string previously produced by Condition.dump()"),
		},
		handler: async ({ dump }) => {
			return Condition.restore(dump as string).toString();
		},
	},
];
