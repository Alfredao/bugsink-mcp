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
