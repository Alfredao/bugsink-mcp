import type { Issue, Paginated } from "./types.js";

export const ISSUE_STATES = ["unresolved", "resolved", "muted", "all"] as const;
export type IssueState = (typeof ISSUE_STATES)[number];

export interface SurveyOptions {
  /** Only issues seen within this many days. */
  days: number;
  state: IssueState;
  /** Drop issues below this event count — noise has a floor. */
  minEvents: number;
  /** Rows to return once filtered. */
  limit: number;
  /** Hard stop on paging, so a wrong window cannot walk the whole project. */
  maxPages: number;
  /** Injected so the caller decides "now"; tests do not depend on the clock. */
  now?: Date;
}

export interface SurveyRow {
  id: string;
  events: number;
  first_seen: string;
  last_seen: string;
  type: string;
  value: string;
  state: string;
}

export interface SurveyResult {
  window_days: number;
  state: IssueState;
  scanned: number;
  pages: number;
  matched: number;
  returned: number;
  complete: boolean;
  note?: string;
  issues: SurveyRow[];
}

export function matchesState(issue: Issue, state: IssueState): boolean {
  switch (state) {
    case "all":
      return true;
    case "resolved":
      return issue.is_resolved;
    case "muted":
      return issue.is_muted;
    case "unresolved":
      return !issue.is_resolved && !issue.is_muted;
  }
}

function stateLabel(issue: Issue): string {
  if (issue.is_resolved) return issue.is_resolved_by_next_release ? "resolved:next-release" : "resolved";
  return issue.is_muted ? "muted" : "open";
}

const MAX_VALUE = 120;

export function toRow(issue: Issue): SurveyRow {
  const value = issue.calculated_value ?? "";
  return {
    id: issue.friendly_id,
    events: issue.stored_event_count,
    first_seen: issue.first_seen.slice(0, 10),
    last_seen: issue.last_seen.slice(0, 10),
    type: issue.calculated_type,
    value: value.length > MAX_VALUE ? `${value.slice(0, MAX_VALUE)}…` : value,
    state: stateLabel(issue),
  };
}

/**
 * Bugsink pages with an opaque cursor carried in a full URL. Pulling the param
 * out is the only way to ask for the next page through a typed client.
 */
export function cursorFrom(next: string | null): string | undefined {
  if (!next) return undefined;
  try {
    return new URL(next).searchParams.get("cursor") ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * The terrain read: which issues are ACTIVE, in what state, most events first.
 *
 * Why this exists as a tool rather than as advice: the API pages at a fixed 250
 * and **silently ignores every filter it does not know** — `is_resolved=false`,
 * `state=unresolved` and `q=is:unresolved` were each measured returning the
 * same unfiltered first page. A caller who believes they filtered reads a
 * resolved backlog as the live one. So the filtering is done here, honestly,
 * and the result says how much was actually scanned.
 *
 * Paging stops early because the fetch is ordered by `last_seen` descending:
 * once an issue falls outside the window, every later one does too.
 */
export async function surveyIssues(
  fetchPage: (cursor?: string) => Promise<Paginated<Issue>>,
  options: SurveyOptions,
): Promise<SurveyResult> {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - options.days * 86_400_000);

  const matched: Issue[] = [];
  let cursor: string | undefined;
  let scanned = 0;
  let pages = 0;
  let outsideWindow = false;

  while (pages < options.maxPages) {
    const page = await fetchPage(cursor);
    pages += 1;
    scanned += page.results.length;

    for (const issue of page.results) {
      if (new Date(issue.last_seen) < cutoff) {
        outsideWindow = true;
        break;
      }
      if (matchesState(issue, options.state) && issue.stored_event_count >= options.minEvents) {
        matched.push(issue);
      }
    }

    cursor = cursorFrom(page.next);
    if (outsideWindow || !cursor) break;
  }

  const complete = outsideWindow || cursor === undefined;
  const rows = matched
    .sort((a, b) => b.stored_event_count - a.stored_event_count)
    .slice(0, options.limit)
    .map(toRow);

  return {
    window_days: options.days,
    state: options.state,
    scanned,
    pages,
    matched: matched.length,
    returned: rows.length,
    complete,
    note: complete
      ? matched.length > rows.length
        ? `${matched.length - rows.length} more issues matched than were returned; raise limit to see them.`
        : undefined
      : `Stopped at the ${options.maxPages}-page cap before reaching the end of the window — these are not all of them.`,
    issues: rows,
  };
}
