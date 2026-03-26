import { z } from "zod";

export const cloneRule = [{
    name: "clone-rule",
    config: {
      title: 'Clone Rule',
      description: "Duplicate an existing rule with a new name, copying all events, conditions, and actions.",
      argsSchema: z.object({
        sourceName: z.string().describe("Name or partial name of the rule to clone"),
        targetName: z.string().optional().describe("Name for the cloned rule"),
      })
    },
    handler: ({ sourceName, targetName }: any) => ({
      messages: [{
        role: "user",
        content: { type: "text", text: `Clone the rule "${sourceName}"${targetName ? ` as "${targetName}"` : ""}.

Workflow:
1. Call list_rules, find rules matching "${sourceName}" (case-insensitive partial match).
2. If multiple match, list them and ask which to clone. If none, show 3 closest and ask for clarification.
3. Call list_rule_components on the source rule.
4. If targetName is missing, ask: "What would you like to name the cloned rule?"
5. Confirm: "I'll clone '[source]' as '[target]' — [N] events, [N] conditions, [N] actions. Proceed?"
6. On yes: create_rule with target name, then create_rule_component for each component in order.
7. Report success and offer to add to a dev library.

Copy components in the same order (sort by order field). Report any failed components but continue.` }
      }]
    })
}]
