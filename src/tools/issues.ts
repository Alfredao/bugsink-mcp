import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BugsinkClient } from "../api.js";
import { issueRef, json } from "./shared.js";

export function registerIssueTools(server: McpServer, client: BugsinkClient): void {
  server.registerTool(
    "list_issues",
    {
      description: "List issues for a project.",
      inputSchema: {
        project_id: z.number().int().describe("Project ID (required by the API)"),
        sort: z.enum(["digest_order", "last_seen", "digested_event_count"]).optional(),
        order: z.enum(["asc", "desc"]).optional(),
        cursor: z.string().optional().describe("Cursor from a previous page"),
      },
    },
    async ({ project_id, sort, order, cursor }) =>
      json(
        await client.listIssues({
          project: project_id,
          ...(sort ? { sort } : {}),
          ...(order ? { order } : {}),
          ...(cursor ? { cursor } : {}),
        }),
      ),
  );

  server.registerTool(
    "resolve_issue",
    {
      description: "Mark an issue as resolved. Answers 400 if it is already resolved.",
      annotations: { destructiveHint: false, idempotentHint: true },
      inputSchema: { issue_id: issueRef },
    },
    async ({ issue_id }) => json(await client.issueAction(issue_id, "resolve")),
  );
}
