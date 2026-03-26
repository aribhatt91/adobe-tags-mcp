import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const compareRules = [{
    name: "compare-rules",
    config: {
      title: "Compare Rules",
      description: "Side-by-side comparison of two rules — events, conditions, and actions. Useful for spotting inconsistencies.",
      argsSchema: z.object({
        ruleA: z.string().describe("Name or partial name of the first rule"),
        ruleB: z.string().describe("Name or partial name of the second rule"),
      })
    },
    handler: ({ ruleA, ruleB }: any) => ({
      messages: [{
        role: "user",
        content: { type: "text", text: `Compare rule "${ruleA}" with rule "${ruleB}".

Workflow:
1. Find both rules via list_rules (partial match). Ask for clarification if ambiguous.
2. Call list_rule_components on both rules.
3. Present comparison:

EVENTS
  ${ruleA}: [event type and settings summary]
  ${ruleB}: [event type and settings summary]
  Match: Yes / No

CONDITIONS
  ${ruleA}: [conditions in order]
  ${ruleB}: [conditions in order]
  Match: Yes / No — [differences]

ACTIONS
  ${ruleA}: [actions in order]
  ${ruleB}: [actions in order]
  Match: Yes / No — [differences]

SUMMARY: [one sentence describing the key difference or "rules are identical"]

If identical, offer to delete one. If different, ask: "Would you like to update one to match the other?"
Never show raw IDs or JSON.` }
      }]
    })
}]
