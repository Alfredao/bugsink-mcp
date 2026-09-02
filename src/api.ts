import type { Issue, Paginated, Project } from "./types.js";

/** An error answer from Bugsink, carrying the status so callers can branch on it. */
export class BugsinkApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Bugsink API ${status}: ${body}`);
    this.name = "BugsinkApiError";
  }
}

export interface BugsinkClientOptions {
  /** Base URL of the instance, e.g. https://bugsink.example.com */
  url: string;
  token: string;
  fetchImpl?: typeof fetch;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

export class BugsinkClient {
  private readonly api: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ url, token, fetchImpl = fetch }: BugsinkClientOptions) {
    this.api = `${url.replace(/\/+$/, "")}/api/canonical/0`;
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  /**
   * One request against the canonical API.
   *
   * Two things this has to get right: a DELETE answers 204 with no body, so the
   * response must not go through `res.json()`; and a bodyless POST needs an
   * explicit Content-Length or the server rejects it.
   */
  async request<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
    if (body === undefined && method !== "GET") headers["Content-Length"] = "0";

    const res = await this.fetchImpl(`${this.api}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const text = await res.text();
    if (!res.ok) throw new BugsinkApiError(res.status, text);
    return (text ? JSON.parse(text) : { ok: true, status: res.status }) as T;
  }

  listProjects(): Promise<Paginated<Project>> {
    return this.request("/projects/");
  }

  listIssues(params: {
    project: number;
    sort?: "digest_order" | "last_seen" | "digested_event_count";
    order?: "asc" | "desc";
    cursor?: string;
  }): Promise<Paginated<Issue>> {
    const qs = new URLSearchParams({ project: String(params.project) });
    if (params.sort) qs.set("sort", params.sort);
    if (params.order) qs.set("order", params.order);
    if (params.cursor) qs.set("cursor", params.cursor);
    return this.request(`/issues/?${qs}`);
  }

  /** `issue` is the UUID or the friendly id (PROJECT-1234); `action` is a path segment. */
  issueAction(issue: string, action: string, body?: unknown): Promise<Issue> {
    return this.request(`/issues/${encodeURIComponent(issue)}/${action}/`, {
      method: "POST",
      ...(body === undefined ? {} : { body }),
    });
  }
}
