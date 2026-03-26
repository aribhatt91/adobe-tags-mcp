import { z } from "zod";

export const buildDevLibrary = [{
    name: "build-dev-library",
    config: {
      title: 'Build Dev Library',
      description: "Add changed resources to a dev library and trigger a build. Only works for development environments.",
      argsSchema: z.object({
        libraryName: z.string().optional().describe("Name for the library"),
        includeAll: z.boolean().optional().describe("Include all changed resources without asking"),
      })
    },
    handler: ({ libraryName, includeAll }: any) => {
      const name = libraryName ?? `Dev Build ${new Date().toISOString().slice(0,16).replace("T"," ")}`;
      const strategy = includeAll
        ? "Add ALL resources that have unpublished changes."
        : "List resources with unpublished changes and ask the user which to include.";
      return {
        messages: [{
          role: "user",
          content: { type: "text", text: `Build a development library named "${name}".

Workflow:
1. Ensure a property is selected.
2. Call list_libraries — if a dev library exists, ask whether to add to it or create a new one.
3. ${strategy}
   Call list_data_elements and list_rules filtered to draft/changed status. Present the list.
4. Call add_resources_to_library for confirmed resources.
5. Call build_library to trigger the build.
6. Poll get_build_status every 5 seconds (max 10 polls).
7. Report: "Dev build completed" / "Build failed — check Tags UI" / "Build still running — check Tags UI".

HARD LIMIT: Only build for environment type "development".
If the environment is staging or production, refuse:
"This tool only builds to development. Staging and production require your standard review process."` }
        }]
      };
  }
}];
