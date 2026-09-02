import { defineTool } from "./define.js";

export const projectTools = [
  defineTool({
    name: "list_projects",
    description:
      "List every project on the Bugsink instance with its id and slug. Use it to turn a project name into the numeric id that list_issues requires.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
    handler: async (_input, { client }) => client.listProjects(),
  }),
];
