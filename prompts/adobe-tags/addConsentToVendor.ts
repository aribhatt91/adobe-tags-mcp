// ============================================================
// src/prompts/addConsentToVendor.ts
//
// PROMPT: add-consent-to-vendor
//
// The most complex prompt in the library. Adds a consent
// condition to ALL rules associated with a named vendor.
//
// WHY THIS EXISTS AS A PROMPT:
// This is a multi-step, potentially destructive bulk operation.
// Without a prompt prescribing the exact workflow, the LLM
// might skip the preview step and start modifying rules
// immediately, or it might not handle pagination correctly,
// or it might place the condition in the wrong position
// (it must be the FIRST condition, not appended).
//
// The prompt enforces the safe pattern:
//   audit → preview → explicit confirmation → bulk update → report
//
// The server-level guard (no staging/production builds) provides
// the hard safety boundary. This prompt provides the UX safety
// layer — making sure the user consciously approves bulk changes.
// ============================================================

import { z } from "zod";

export const addConsentToVendor = [{
    name: "add-consent-to-vendor",
    config: {
      title: "Add Consent to Vendor",
      description: "Add a consent condition to all rules associated with a specific vendor (e.g. Meta, Google, TikTok). Shows a preview and requires confirmation before making any changes.",
      argsSchema: z.object({
          vendor: z
            .string()
            .describe(
              "The vendor name to match rules against, e.g. 'Meta', 'Facebook', 'Google Analytics', 'TikTok'"
            ),
          consentCategory: z
            .string()
            .describe(
              "The consent category to enforce, e.g. C0004 for targeting/advertising cookies"
            ),
          conditionExtensionId: z
            .string()
            .optional()
            .describe(
              "Optional: the extension ID that provides the consent condition type. If omitted, search installed extensions for a consent management extension."
            ),
        })
    },
    cb: ({ vendor, consentCategory, conditionExtensionId }: any) => {
      const extensionText = conditionExtensionId
        ? `Use extension ID "${conditionExtensionId}" for the condition component.`
        : `First call list_extensions to find the installed consent management extension (look for OneTrust, Cookiebot, or similar). Use its ID for the condition component.`;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Add a "${consentCategory}" consent condition to all rules for "${vendor}".

--- PHASE 1: DISCOVERY (read only, no changes) ---

1. Call list_rules and paginate through ALL pages.
2. Filter to rules whose name contains "${vendor}" OR whose action components use an extension associated with "${vendor}" (check extension package name for "facebook", "meta", or the vendor name, case-insensitive).
3. For each matching rule, call list_rule_components to check if it already has a "${consentCategory}" consent condition.
4. Build two lists:
   - Already has consent: skip these
   - Needs consent added: these will be modified

--- PHASE 2: PREVIEW (show user, wait for confirmation) ---

Present the results as:
"Found [N] rules for ${vendor}. [X] already have the ${consentCategory} consent check. I will add it to [Y] rules:

1. [Rule name]
2. [Rule name]
...

Shall I proceed? This will modify [Y] rules on the dev property. Type YES to confirm."

STOP HERE. Do not proceed until the user explicitly confirms.
Accept: "yes", "YES", "confirm", "go ahead", "do it", "proceed".
Treat anything hesitant or unclear as a no — say "No changes made. Let me know if you'd like to review the list or adjust the scope."
If the user asks a question instead of confirming, answer it and re-show the confirmation prompt.

--- PHASE 3: BULK UPDATE (only after confirmation) ---

${extensionText}

For each rule in the "needs consent" list:
1. Call create_rule_component to add the consent condition with these settings:
   - type: "condition"
   - category: "${consentCategory}"
   - order: 0  (must be the FIRST condition, placed before any existing conditions)
   - negate: false
2. Log the rule name as either "updated" or "failed" after each call.
3. If a call fails, continue to the next rule — do not stop the whole operation.

--- PHASE 4: REPORT ---

After all updates, show:
"Done. Added ${consentCategory} consent condition to [N] rules:
  Updated: [list of rule names]
  Failed (check manually): [list if any]
  Already had consent: [count] rules skipped"

Then ask: "Would you like to add these changes to a dev library and build it?"

--- SAFETY RULES (always enforce) ---
- Never submit, build, or publish to staging or production.
- Never delete existing conditions when adding the new one.
- Never show raw IDs, GUIDs, or API response objects to the user.
- If no property is selected, call list_properties first and ask the user to select one.`,
            },
          },
        ],
      };
    }
}];
