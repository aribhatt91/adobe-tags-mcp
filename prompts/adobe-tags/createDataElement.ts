// ============================================================
// src/prompts/createDataElement.ts
//
// PROMPT: create-data-element
//
// Guided data element creation. Asks for missing information
// progressively rather than failing on the first missing field.
// ============================================================

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const createDataElement = [{
    name: "create-data-element",
    config: {
      title: 'Create Data element',
      description: "Guided workflow to create a new data element. Prompts for any missing required information before creating.",
      argsSchema: z.object({
        name: z
          .string()
          .optional()
          .describe("Name for the data element"),
        type: z
          .string()
          .optional()
          .describe(
            "Data element type, e.g. 'JavaScript Variable', 'CSS Selector', 'Data Layer', 'Cookie', 'Custom Code'"
          ),
        value: z
          .string()
          .optional()
          .describe(
            "The path, selector, variable name, or value depending on type"
          ),
      })
    },
    handler: ({ name, type, value }: any) => {
      const provided: string[] = [];
      const missing: string[] = [];

      if (name) provided.push(`Name: "${name}"`);
      else missing.push("name");

      if (type) provided.push(`Type: "${type}"`);
      else missing.push("type");

      if (value) provided.push(`Value/path: "${value}"`);
      else missing.push("value or path");

      const providedText =
        provided.length > 0
          ? `The user has provided: ${provided.join(", ")}.`
          : "The user has not provided any details yet.";

      const missingText =
        missing.length > 0
          ? `Still needed: ${missing.join(", ")}.`
          : "All required fields are provided.";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Create a new data element on the selected property.

${providedText}
${missingText}

Workflow:
1. If a property is not yet selected, call list_properties and ask the user to choose one first.
2. If the name is missing, ask: "What would you like to name this data element?"
3. If the type is missing, call list_extensions to get installed extensions, then present the available data element types as a numbered list and ask the user to choose.
4. If the value/path is missing, ask for it based on the type:
   - JavaScript Variable → "What is the JavaScript variable path? (e.g. digitalData.page.pageInfo.pageName)"
   - Cookie → "What is the cookie name?"
   - CSS Selector → "What is the CSS selector and which attribute should be read?"
   - Data Layer → "What is the data layer path?"
   - Custom Code → "Please provide the JavaScript code for this data element."
5. Confirm the details before creating:
   "I'll create a data element with these settings:
    Name: [name]
    Type: [type]
    Value: [value]
    Storage: Session (default)
   Shall I proceed?"
6. On confirmation, call create_data_element.
7. Confirm: "Created data element '[name]'. Would you like to add it to a dev library?"

Never show raw IDs. Never create without user confirmation.`,
            },
          },
        ],
      };
  }
}]
