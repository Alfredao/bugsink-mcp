/** Shapes returned by the Bugsink canonical API (version 0). */

export interface Paginated<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Project {
  id: number;
  team: string;
  name: string;
  slug: string;
  dsn: string;
  digested_event_count: number;
  stored_event_count: number;
  alert_on_new_issue: boolean;
  alert_on_regression: boolean;
  alert_on_unmute: boolean;
  visibility: string;
  retention_max_event_count: number;
}

export interface Issue {
  id: string;
  friendly_id: string;
  project: number;
  digest_order: number;
  first_seen: string;
  last_seen: string;
  digested_event_count: number;
  stored_event_count: number;
  calculated_type: string;
  calculated_value: string;
  transaction: string;
  is_resolved: boolean;
  is_resolved_by_next_release: boolean;
  is_muted: boolean;
}

export interface IssueComment {
  id: number;
  issue: string;
  project: number;
  timestamp: string;
  comment: string;
  user: number | null;
}

/** The period vocabulary the mute actions accept. */
export const PERIOD_NAMES = ["year", "month", "week", "day", "hour", "minute"] as const;
export type PeriodName = (typeof PERIOD_NAMES)[number];

/** An event as it appears in a list: metadata only, no payload. */
export interface EventSummary {
  id: string;
  event_id: string;
  issue: string;
  project: number;
  grouping: number;
  timestamp: string;
  ingested_at: string;
  digested_at: string;
  digest_order: number;
}

/** One frame of a stacktrace, as Sentry-compatible payloads carry it. */
export interface StackFrame {
  filename?: string;
  abs_path?: string;
  module?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  context_line?: string;
}

export interface ExceptionValue {
  type?: string;
  value?: string;
  stacktrace?: { frames?: StackFrame[] };
}

/**
 * The event payload. Only the parts we read are named; the index signature
 * keeps the rest reachable, because what an SDK sends varies by platform and
 * dropping unknown keys would lose exactly the context a diagnosis needs.
 */
export interface EventData {
  exception?: { values?: ExceptionValue[] };
  logentry?: { message?: string; formatted?: string };
  request?: { url?: string; method?: string };
  contexts?: Record<string, unknown>;
  level?: string;
  environment?: string;
  release?: string;
  transaction?: string;
  server_name?: string;
  platform?: string;
  [key: string]: unknown;
}

/**
 * One event with its payload. `stacktrace_md` is rendered by Bugsink itself,
 * with source context lines — it is the cheapest useful read of a crash.
 */
export interface EventDetail extends EventSummary {
  stacktrace_md: string | null;
  data: EventData;
}
