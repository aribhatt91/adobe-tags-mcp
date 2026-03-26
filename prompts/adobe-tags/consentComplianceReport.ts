// ============================================================
// src/prompts/consentComplianceReport.ts
//
// PROMPT: consent-compliance-report
//
// Designed specifically for non-technical stakeholders —
// analysts, managers, legal/compliance reviewers — who need
// to understand the consent posture of their tag property
// without any technical knowledge of how Tags works.
//
// WHY THIS EXISTS AS A PROMPT:
// A developer asking "audit consent" wants a rule-by-rule
// list they can act on. A compliance manager asking "are we
// compliant?" wants a plain-English summary they can present
// to a team or include in a report. Same underlying data,
// completely different framing. This prompt produces the
// latter — a human-readable report with no technical jargon.
// ============================================================

import { z } from "zod";

export const consentComplianceReport = [
  {
    name: "Consent Compliance Report",
    config: {
      title: "Consent Compliance Report",
      description: "Generate a plain-English consent compliance summary for a Tag property. Designed for non-technical stakeholders — no jargon, no IDs, no code.",
      argsSchema: z.object({
        consentCategory: z
          .string()
          .default("C0004")
          .describe(
            "The consent category to check for. C0004 = targeting/advertising cookies (default). C0002 = performance cookies. C0003 = functional cookies."
          ),
        vendorFilter: z
          .string()
          .optional()
          .describe(
            "Optional: limit the report to a specific vendor or platform, e.g. 'Meta', 'Google', 'TikTok'"
          ),
        })
    },
    handler: ({ consentCategory, vendorFilter }: any) => {
      const scope = vendorFilter
        ? `Focus only on tags related to "${vendorFilter}".`
        : "Cover all tags on the property.";

      const categoryLabel: Record<string, string> = {
        C0004: "targeting and advertising cookies (C0004)",
        C0002: "performance and analytics cookies (C0002)",
        C0003: "functional cookies (C0003)",
      };
      const categoryDescription =
        categoryLabel[consentCategory] ??
        `consent category ${consentCategory}`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Generate a consent compliance summary report for ${categoryDescription}.
${scope}

This report is for a non-technical audience. Plain English only — no rule IDs, extension IDs, component names, or technical jargon.

--- DATA COLLECTION (read only, no changes) ---

1. Call list_rules and paginate through all pages.
2. ${vendorFilter ? `Filter to rules whose names suggest a relationship to "${vendorFilter}".` : "Include all rules."}
3. For each relevant rule, call list_rule_components and check for a consent condition matching ${consentCategory}.
4. Categorise each rule as: compliant (has the check) or non-compliant (missing the check).
5. Group non-compliant rules by likely vendor/purpose based on their names.

--- REPORT FORMAT ---

Write the report in this structure:

## Consent compliance summary
Property: [property name]
Checked: ${categoryDescription}
Date: [today's date]

### Overall status
[One sentence: e.g. "18 of 22 advertising tags have the required consent check in place."]
[One sentence risk statement if any are missing, e.g. "4 tags may fire without user consent, which could present a compliance risk."]

### What we checked
[One plain-English sentence explaining what ${consentCategory} means and why it matters — no code.]

### Tags with consent check in place
[List vendor/purpose groups, not individual rule names. E.g. "Meta advertising tags (3)", "Google Ads (2)"]
[If all are compliant, say so clearly.]

### Tags missing the consent check
[List by vendor/purpose group with count, e.g. "TikTok pixel tags (2)", "Pinterest (1)"]
[If none are missing, say "All checked tags have the consent check in place."]

### Recommended next steps
[If non-compliant tags exist:]
- "Ask your tag manager or developer to add the ${consentCategory} consent check to the [N] tags listed above."
- "These changes can be made in the development environment and reviewed before publishing."
- "After changes are made, run this report again to confirm all tags are compliant."

[If fully compliant:]
- "No action required. Consider scheduling a monthly compliance check."

---

Tone: clear, factual, non-alarmist. Avoid words like "broken", "violated", "illegal".
Use "may present a compliance risk" rather than "is non-compliant" for missing checks.
Never show rule IDs, component IDs, extension names, or API terminology.
Never suggest making changes yourself — direct the reader to their tag manager or developer.`,
            },
          },
        ],
      };
    }
  }
];