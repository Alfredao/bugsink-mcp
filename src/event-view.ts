import type { EventDetail, StackFrame } from "./types.js";

/**
 * Optional slices of an event. They are opt-in because the default read has to
 * stay cheap: on a real event measured here, `breadcrumbs` alone was 30 KB of a
 * 51 KB payload, and an agent that pays for it on every triage stops triaging.
 */
export const EVENT_SECTIONS = ["breadcrumbs", "contexts", "modules", "raw"] as const;
export type EventSection = (typeof EVENT_SECTIONS)[number];

/** Anything under node_modules, or a Node builtin, is somebody else's code. */
const VENDOR = /(^|[/\\])node_modules[/\\]|^node:/;

function frames(event: EventDetail): StackFrame[] {
  return event.data?.exception?.values?.[0]?.stacktrace?.frames ?? [];
}

function describe(frame: StackFrame): string {
  const where = frame.filename ?? frame.abs_path ?? frame.module ?? "?";
  return `${where}:${frame.lineno ?? "?"} in ${frame.function ?? "?"}`;
}

/**
 * OUR frames, innermost first.
 *
 * The payload orders frames oldest-to-newest, so the throw site is last; this
 * reverses that, because the reader wants the throw site first. The vendor
 * filter is the point: on the AWS S3 issue that motivated this tool, the first
 * eleven frames are all SDK internals and none of them names a file anyone here
 * can edit. An empty result is meaningful — it says the crash never passed
 * through code we own, so `where` is the lead instead.
 */
export function appFrames(event: EventDetail): string[] {
  return frames(event)
    .filter((frame) => {
      const path = frame.filename ?? frame.abs_path;
      return typeof path === "string" && !VENDOR.test(path);
    })
    .map(describe)
    .reverse();
}

/** Best available answer to "where did this happen", for events with no app frame. */
export function locate(event: EventDetail): string | undefined {
  const { data } = event;
  const nextjs = data.contexts?.["nextjs"];
  const requestPath =
    nextjs && typeof nextjs === "object" && "request_path" in nextjs
      ? (nextjs as { request_path?: unknown }).request_path
      : undefined;
  if (data.request?.url) return data.request.url;
  if (typeof requestPath === "string") return requestPath;
  return data.transaction;
}

/**
 * The default read of an event: what failed, where, our frames, and Bugsink's
 * own rendered stacktrace with source context. Heavy sections are added only
 * when asked for, and `raw` returns the untouched payload for the rare case
 * where the summary dropped the thing that mattered.
 */
export function summarizeEvent(event: EventDetail, include: EventSection[] = []): object {
  if (include.includes("raw")) return event;

  const failure = event.data.exception?.values?.[0];
  const message = event.data.logentry?.formatted ?? event.data.logentry?.message;
  const ours = appFrames(event);

  return {
    id: event.id,
    event_id: event.event_id,
    issue: event.issue,
    timestamp: event.timestamp,
    level: event.data.level,
    environment: event.data.environment,
    release: event.data.release ?? null,
    server_name: event.data.server_name,
    type: failure?.type,
    value: failure?.value ?? message,
    where: locate(event),
    app_frames: ours,
    ...(ours.length === 0
      ? { app_frames_note: "No frame outside node_modules — the crash did not pass through our code." }
      : {}),
    stacktrace_md: event.stacktrace_md,
    ...(include.includes("breadcrumbs") ? { breadcrumbs: event.data["breadcrumbs"] } : {}),
    ...(include.includes("contexts") ? { contexts: event.data.contexts } : {}),
    ...(include.includes("modules") ? { modules: event.data["modules"] } : {}),
  };
}
