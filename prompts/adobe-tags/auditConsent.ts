// ============================================================
// src/prompts/auditConsent.ts
//
// PROMPT: audit-consent
//
// Audits ALL rules on the selected property for a named consent
// condition. Returns a clear pass/fail list so the user knows
// exactly which rules need attention before they ask the agent
// to fix them.
//
// WHY THIS EXISTS AS A PROMPT:
// "Which rules are missing consent?" is a common pre-flight
// question before a bulk fix. Without a prompt, the LLM might
// call get_rules once and only check the first page, or it
// might not know to check rule components for the condition.
// This prompt spells out the exact audit algorithm so the
// output is always complete and structured the same way.
// ============================================================

import { z } from "zod";

export const auditConsent = [{
    name: "audit-consent",
    config: {
      title: "Audit Consent",
      description: "Audit all rules on the selected property to find which ones are missing a specific consent condition. Produces a pass/fail report grouped by vendor.",
      argsSchema: z.object({
        consentCategory: z
          .string()
          .describe(
            "The consent category code to check for, e.g. C0004 for targeting cookies"
          ),
        vendorFilter: z
          .string()
          .optional()
          .describe(
            "Optional: filter audit to rules matching this vendor name, e.g. 'Meta' or 'Google Analytics'"
          ),
      })
    },
    handler: ({ consentCategory, vendorFilter }: any) => {
      const scopeText = vendorFilter
        ? `Scope the audit to rules whose name contains "${vendorFilter}".`
        : "Audit ALL rules on the property regardless of name.";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Run a consent audit for category "${consentCategory}".

${scopeText}

Algorithm:
1. Call list_rules to get all rules. Paginate if necessary — do not stop at the first page.
2. For each rule, call list_rule_components to get its conditions.
3. Check whether any condition component has settings that reference "${consentCategory}".
4. Build two lists:
   - PASS: rules that already have the consent condition
   - FAIL: rules that are missing it

Output format:
Show a summary line: "X of Y rules have the ${consentCategory} consent check."
Then show the FAIL list as a numbered list of rule names only.
Then ask: "Would you like me to add the ${consentCategory} consent condition to the failing rules?"

Important:
- Never show rule IDs or component IDs to the user.
- If the FAIL list is empty, say "All rules already have the ${consentCategory} consent check." and stop.
- Do not make any changes during this audit — read only.`,
            },
          },
        ],
      };
    }
}]
