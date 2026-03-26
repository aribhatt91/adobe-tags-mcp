import { z } from "zod";

export const findByDataElement = [{
    name: "find-by-data-element",
    config: {
      title: "Find by data element",
      description: "Find all rules and data elements that reference a specific data element. Run this before renaming or deleting.",
      argsSchema: {
        dataElementName: z.string().describe("Name or partial name of the data element to search for"),
      }
    },
    handler: ({ dataElementName }: any) => ({
      messages: [{
        role: "user",
        content: { type: "text", text: `Find everything that references the data element "${dataElementName}".

Workflow:
1. Call list_data_elements and find the element matching "${dataElementName}". Ask if ambiguous.
2. Search all rule components: call list_rules, then list_rule_components per rule.
   Look for %${dataElementName}% pattern or the element ID in component settings JSON.
3. Search other data elements: call list_data_elements and check each element's settings.
4. Output:
   "Data element '${dataElementName}' is referenced in:
   Rules ([N]): [rule names as list]
   Other data elements ([N]): [element names as list]
   Safe to delete: Yes / No"

If nothing references it: "No rules or data elements reference '${dataElementName}'. Safe to delete."
Never show IDs.` }
      }]
    })
}]
