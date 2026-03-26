// ============================================================
// src/prompts/createRule.ts
//
// PROMPT: create-rule
//
// Guided rule creation. Walks through events → conditions →
// actions in the correct order, asking for each piece.
// ============================================================

import { z } from "zod";

export const createRule = [{
    name: "create-rule",
    config: {
      title: 'Create Rule',
      description: "Guided workflow to create a complete rule with events, conditions, and actions. Asks for missing information at each step.",
      argsSchema: z.object({
        name: z.string().optional().describe("Name for the rule"),
        trigger: z
          .string()
          .optional()
          .describe(
            "When should this rule fire? e.g. 'page bottom', 'DOM ready', 'click on button', 'custom event'"
          ),
        vendor: z
          .string()
          .optional()
          .describe(
            "Optional: which vendor or tag does this rule send data to? e.g. 'Meta', 'Google Analytics'"
          ),
      })
    },
    handler: ({ name, trigger, vendor }: any) => {
      const context = [
        name ? `Rule name: "${name}"` : null,
        trigger ? `Trigger: "${trigger}"` : null,
        vendor ? `Vendor/destination: "${vendor}"` : null,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Create a new rule on the selected property.

${context || "No details provided yet."}

Workflow — follow these steps in order:

STEP 1 — Name
If the name is missing, ask: "What would you like to call this rule?"
Use a clear naming convention: [Vendor] - [Trigger] - [Action], e.g. "Meta - Page View - Track Event".

STEP 2 — Event (trigger)
If the trigger is unclear, present the common options:
  1. Page Bottom
  2. DOM Ready  
  3. Window Loaded
  4. Click (ask for selector)
  5. Custom Event (ask for event name)
  6. Direct Call Rule
Ask which one applies. Call list_extensions if you need the extension IDs for the event types.

STEP 3 — Consent condition
Ask: "Should this rule require a consent check? If so, which consent category? (e.g. C0004 for targeting)"
If yes, add the consent condition as the FIRST condition (order: 0).
If no, skip conditions.

STEP 4 — Action
If a vendor was provided, suggest the most likely action type for that vendor.
Otherwise ask: "What should this rule do? Which extension provides the action?"
Call list_extensions to get available action types.
Ask for the specific settings required by the chosen action type.

STEP 5 — Confirm before creating
Show a summary:
"I'll create this rule:
  Name: [name]
  Event: [trigger]
  Condition: [consent check or 'none']
  Action: [action description]
Shall I proceed?"

STEP 6 — Create
On confirmation:
1. Call create_rule with the name.
2. Call create_rule_component for the event.
3. Call create_rule_component for the consent condition (if applicable), order: 0.
4. Call create_rule_component for the action.

STEP 7 — Confirm and offer next step
"Created rule '[name]'. Would you like to add it to a dev library and build?"

Never show raw IDs. Never create components before the rule itself exists.
Never submit to staging or production.`,
            },
          },
        ],
      };
    }
}]
