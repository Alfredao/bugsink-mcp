import { defineTool } from "./define.js";

export const metaTools = [
  defineTool({
    name: "test_connection",
    description:
      "Check that the configured Bugsink URL and token work, and list the projects the token can see. Call this first when a Bugsink tool fails for an unclear reason.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
    handler: async (_input, { client }) => {
      const { results } = await client.listProjects();
      const projects = results.map((p) => `${p.id}:${p.slug}`).join(", ");
      return `Connected. Projects: ${projects || "none"}`;
    },
  }),
];
