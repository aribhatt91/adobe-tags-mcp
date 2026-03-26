// ============================================================
// src/prompts/selectProperty.ts
//
// PROMPT: select-property
//
// The starting point for almost every session. Forces the agent
// to fetch all available properties and present them cleanly
// before doing anything else.
//
// WHY THIS EXISTS AS A PROMPT:
// Without this, a user saying "create a data element" would
// trigger the LLM to call create_data_element immediately and
// then fail because no property is selected. This prompt
// front-loads the selection step as a named, intentional workflow.
// ============================================================


export const selectProperty = [{
    name: "select-property",
    config: {
      title: "Select property",
      description: "List all available Adobe Tag properties and guide the user to select one for the session. Always run this at the start of a session before any other operation.",
      argsSchema: {},  // no args — this is always a fresh fetch
    },
    handler: () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Start a new Adobe Tags session.

Step 1: Call list_properties to fetch all available Tag properties.
Step 2: Present them as a numbered list showing only: property name, environment (dev/staging/prod), and whether it is enabled.
Step 3: Ask the user which property they want to work with.
Step 4: Once the user selects one, confirm: "Working on: [Property Name]. What would you like to do?"

Do not perform any other actions until the user has selected a property.
Never show raw property IDs to the user — use them internally only.`,
          },
        },
      ],
    })
}]
