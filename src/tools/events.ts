import { z } from "zod";
import { defineTool } from "./define.js";
import { issueRef } from "./shared.js";
import { EVENT_SECTIONS, summarizeEvent, type EventSection } from "../event-view.js";

const sections = z
  .array(z.enum(EVENT_SECTIONS))
  .optional()
  .describe("Extra slices to include: breadcrumbs, contexts, modules, or raw for the untouched payload");

export const eventTools = [
  defineTool({
    name: "list_events",
    description:
      "List the individual occurrences of one issue, newest first. Use it to see when an error started and stopped, or to reach an older occurrence than the latest — for a diagnosis, get_latest_event is usually the faster call.",
    inputSchema: {
      issue_id: issueRef,
      cursor: z.string().optional().describe("Cursor from a previous page"),
    },
    annotations: { readOnlyHint: true },
    handler: async ({ issue_id, cursor }, { client }) =>
      client.listEvents({ issue: issue_id, ...(cursor ? { cursor } : {}) }),
  }),

  defineTool({
    name: "get_event",
    description:
      "Read one occurrence: what failed, where, the frames outside node_modules, and Bugsink's rendered stacktrace with source context. Takes the Bugsink event id from list_events, NOT the SDK event_id. Breadcrumbs, contexts and modules are omitted unless asked for, because they dominate the payload.",
    inputSchema: { event_id: z.string().min(1).describe("Bugsink event id (the `id` from list_events)"), include: sections },
    annotations: { readOnlyHint: true },
    handler: async ({ event_id, include }, { client }) =>
      summarizeEvent(await client.getEvent(event_id), (include ?? []) as EventSection[]),
  }),

  defineTool({
    name: "get_latest_event",
    description:
      "Read the most recent occurrence of an issue in one call — the usual starting point for diagnosing it. Same output as get_event, without having to list occurrences first.",
    inputSchema: { issue_id: issueRef, include: sections },
    annotations: { readOnlyHint: true },
    handler: async ({ issue_id, include }, { client }) => {
      const { results } = await client.listEvents({ issue: issue_id });
      const latest = results[0];
      if (!latest) return `Issue ${issue_id} has no stored events — retention may have evicted them.`;
      return summarizeEvent(await client.getEvent(latest.id), (include ?? []) as EventSection[]);
    },
  }),
];
