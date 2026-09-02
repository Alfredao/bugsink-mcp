import { z } from "zod";
import { defineTool } from "./define.js";
import { issueRef } from "./shared.js";

export const issueTools = [
  defineTool({
    name: "list_issues",
    description:
      "List the issues of one project, newest activity first when sorted by last_seen. Requires a numeric project id.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID (required by the API)"),
      sort: z.enum(["digest_order", "last_seen", "digested_event_count"]).optional(),
      order: z.enum(["asc", "desc"]).optional(),
      cursor: z.string().optional().describe("Cursor from a previous page"),
    },
    annotations: { readOnlyHint: true },
    handler: async ({ project_id, sort, order, cursor }, { client }) =>
      client.listIssues({
        project: project_id,
        ...(sort ? { sort } : {}),
        ...(order ? { order } : {}),
        ...(cursor ? { cursor } : {}),
      }),
  }),

  defineTool({
    name: "resolve_issue",
    description:
      "Mark an issue as resolved. Use it once the underlying bug is fixed; if the error happens again Bugsink reopens the issue as a regression.",
    inputSchema: { issue_id: issueRef },
    annotations: { idempotentHint: true },
    handler: async ({ issue_id }, { client }) => client.issueAction(issue_id, "resolve"),
  }),
];
