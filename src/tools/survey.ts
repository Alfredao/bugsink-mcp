import { z } from "zod";
import { defineTool } from "./define.js";
import { ISSUE_STATES, surveyIssues, type IssueState } from "../survey.js";

export const surveyTools = [
  defineTool({
    name: "survey_issues",
    description:
      "Survey what is actually active in a project: issues seen within a window, filtered by state, biggest first, as compact rows. Start triage here instead of list_issues — the API pages at a fixed 250 and silently ignores state filters, so an unfiltered page reads as if it were filtered. The result reports how much was scanned and whether it is complete.",
    inputSchema: {
      project_id: z.number().int().describe("Project ID — call list_projects if you only have the name"),
      days: z.number().int().min(1).max(365).optional().describe("Window in days (default 7)"),
      state: z.enum(ISSUE_STATES).optional().describe("unresolved (default), resolved, muted, or all"),
      min_events: z.number().int().min(0).optional().describe("Ignore issues below this event count (default 0)"),
      limit: z.number().int().min(1).max(200).optional().describe("Rows to return (default 60)"),
      max_pages: z.number().int().min(1).max(50).optional().describe("Cap on pages fetched (default 8)"),
    },
    annotations: { readOnlyHint: true },
    handler: async ({ project_id, days, state, min_events, limit, max_pages }, { client }) =>
      surveyIssues(
        (cursor) =>
          client.listIssues({
            project: project_id,
            sort: "last_seen",
            order: "desc",
            ...(cursor ? { cursor } : {}),
          }),
        {
          days: days ?? 7,
          state: (state ?? "unresolved") as IssueState,
          minEvents: min_events ?? 0,
          limit: limit ?? 60,
          maxPages: max_pages ?? 8,
        },
      ),
  }),
];
