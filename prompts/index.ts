// ============================================================
// src/prompts/index.ts
//
// Central registration point for all MCP prompts.
// Import this in src/index.ts and call registerAllPrompts(server).
// ============================================================

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { selectProperty }      from "./adobe-tags/selectProperty.js";
import { auditConsent }        from "./adobe-tags/auditConsent.js";
import { addConsentToVendor }  from "./adobe-tags/addConsentToVendor.js";
import { createDataElement }   from "./adobe-tags/createDataElement.js";
import { createRule }          from "./adobe-tags/createRule.js";
import { buildDevLibrary }     from "./adobe-tags/buildDevLibrary.js";
import { cloneRule }           from "./adobe-tags/cloneRule.js";
import { findByDataElement }   from "./adobe-tags/findByDataElement.js";
import { compareRules }        from "./adobe-tags/compareRules.js";
import { consentComplianceReport } from "./adobe-tags/consentComplianceReport.js";

export function registerAdobePrompts(server: McpServer): void {
  const prompts: any[] = [
    ...selectProperty,
    ...auditConsent,
    ...addConsentToVendor,
    ...createDataElement,
    ...createRule,
    ...buildDevLibrary,
    ...cloneRule,
    ...findByDataElement,
    ...compareRules,
    ...consentComplianceReport
  ]
  prompts.forEach((p: any) => {
    const { name, config, handler } = p;
    server.registerPrompt(name, config, handler)
  })
}
