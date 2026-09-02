import { z } from "zod";
import { defineTool } from "./define.js";
import { issueRef, nrOfPeriods, periodName } from "./shared.js";

export const issueTools = [
  defineTool({
    name: "list_issues",
    description:
      "List the issues of one project, newest activity first when sorted by last_seen. Requires a numeric project id — call list_projects if you only have the name.",
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
    name: "get_issue",
    description:
      "Read one issue: its type and value, when it was first and last seen, how many events it has, and whether it is resolved or muted. Use it to check state before resolving or muting.",
    inputSchema: { issue_id: issueRef },
    annotations: { readOnlyHint: true },
    handler: async ({ issue_id }, { client }) => client.getIssue(issue_id),
  }),

  defineTool({
    name: "resolve_issue",
    description:
      "Mark an issue as resolved. Use it once the underlying bug is fixed; if the error happens again Bugsink reopens the issue as a regression.",
    inputSchema: { issue_id: issueRef },
    annotations: { idempotentHint: true },
    handler: async ({ issue_id }, { client }) => client.issueAction(issue_id, "resolve"),
  }),

  defineTool({
    name: "resolve_issue_next_release",
    description:
      "Mark an issue as resolved by the next release. Use it when the fix is merged but not deployed — the issue reopens only if the error survives that release.",
    inputSchema: { issue_id: issueRef },
    annotations: { idempotentHint: true },
    handler: async ({ issue_id }, { client }) => client.issueAction(issue_id, "resolve-next"),
  }),

  defineTool({
    name: "resolve_issue_latest_release",
    description:
      "Mark an issue as resolved in the latest known release. Use it when the fix is already deployed — the issue reopens only if the error appears in a later release.",
    inputSchema: { issue_id: issueRef },
    annotations: { idempotentHint: true },
    handler: async ({ issue_id }, { client }) => client.issueAction(issue_id, "resolve-latest"),
  }),

  defineTool({
    name: "mute_issue",
    description:
      "Mute an issue indefinitely so it stops raising alerts, without claiming it is fixed. Use it for known noise. A resolved or already muted issue is declined.",
    inputSchema: { issue_id: issueRef },
    annotations: { idempotentHint: true },
    handler: async ({ issue_id }, { client }) => client.issueAction(issue_id, "mute"),
  }),

  defineTool({
    name: "mute_issue_for",
    description:
      "Mute an issue for a fixed period, e.g. 2 weeks, after which it alerts again on its own. Use it to defer noise you intend to come back to.",
    inputSchema: { issue_id: issueRef, period_name: periodName, nr_of_periods: nrOfPeriods },
    handler: async ({ issue_id, period_name, nr_of_periods }, { client }) =>
      client.issueAction(issue_id, "mute-for", { period_name, nr_of_periods }),
  }),

  defineTool({
    name: "mute_issue_until",
    description:
      "Mute an issue until it gets loud, e.g. unmute on more than 10 events in 1 hour. Use it for a known-but-tolerable error you want to hear about only if it escalates.",
    inputSchema: {
      issue_id: issueRef,
      period_name: periodName,
      nr_of_periods: nrOfPeriods,
      gte_threshold: z.number().int().min(1).describe("Event count within the period that lifts the mute"),
    },
    handler: async ({ issue_id, period_name, nr_of_periods, gte_threshold }, { client }) =>
      client.issueAction(issue_id, "mute-until", { period_name, nr_of_periods, gte_threshold }),
  }),

  defineTool({
    name: "unmute_issue",
    description:
      "Unmute an issue so it alerts again. An issue that is resolved, or that was not muted, is declined.",
    inputSchema: { issue_id: issueRef },
    annotations: { idempotentHint: true },
    handler: async ({ issue_id }, { client }) => client.issueAction(issue_id, "unmute"),
  }),

  defineTool({
    name: "add_issue_comment",
    description:
      "Add a comment to an issue's history — a diagnosis, a link to a fix, why it was muted. The comment is recorded without an author, because the API token is a global token rather than a person.",
    inputSchema: { issue_id: issueRef, comment: z.string().min(1).describe("The comment text") },
    handler: async ({ issue_id, comment }, { client }) => client.addIssueComment(issue_id, comment),
  }),
];
