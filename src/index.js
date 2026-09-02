#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (process.env.BUGSINK_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.BUGSINK_TOKEN || "";
const API = `${BASE_URL}/api/canonical/0`;

if (!BASE_URL || !TOKEN) {
  console.error("bugsink-mcp: BUGSINK_URL and BUGSINK_TOKEN are required");
  process.exit(1);
}

/**
 * One call against the Bugsink canonical API.
 *
 * Two things the response handling has to get right: a DELETE answers 204 with
 * no body, and a bodyless POST needs an explicit Content-Length or the server
 * rejects it.
 */
async function api(path, { method = "GET", body = null } = {}) {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  };
  if (!body && method !== "GET" && method !== "HEAD") headers["Content-Length"] = "0";

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Bugsink API ${res.status}: ${text}`);
  return text ? JSON.parse(text) : { ok: true, status: res.status };
}

/** Every tool answers with the raw JSON, so nothing is lost in a summary. */
const json = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });

/** Bugsink accepts either the UUID or the friendly id, e.g. PROJECT-1234. */
const issueRef = () => z.string().describe("Issue UUID or friendly ID (e.g. PROJECT-1234)");

const server = new McpServer({ name: "bugsink", version: "0.1.0" });

server.tool(
  "test_connection",
  "Check that the Bugsink URL and token work.",
  {},
  async () => {
    const data = await api("/projects/");
    const names = (data.results || []).map((p) => `${p.id}:${p.slug}`).join(", ");
    return { content: [{ type: "text", text: `Connected to ${BASE_URL}. Projects: ${names || "none"}` }] };
  }
);

// --- read ------------------------------------------------------------------

server.tool(
  "list_issues",
  "List issues for a project.",
  {
    project_id: z.number().int().describe("Project ID (required by the API)"),
    sort: z.enum(["digest_order", "last_seen", "digested_event_count"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
    cursor: z.string().optional().describe("Cursor from a previous page"),
  },
  async ({ project_id, sort, order, cursor }) => {
    const qs = new URLSearchParams({ project: String(project_id) });
    if (sort) qs.set("sort", sort);
    if (order) qs.set("order", order);
    if (cursor) qs.set("cursor", cursor);
    return json(await api(`/issues/?${qs}`));
  }
);

// --- write -----------------------------------------------------------------

server.tool(
  "resolve_issue",
  "Mark an issue as resolved. Answers 400 if it is already resolved.",
  { issue_id: issueRef() },
  async ({ issue_id }) => json(await api(`/issues/${encodeURIComponent(issue_id)}/resolve/`, { method: "POST" }))
);

await server.connect(new StdioServerTransport());
