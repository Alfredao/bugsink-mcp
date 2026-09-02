# bugsink-mcp

An MCP server for [Bugsink](https://www.bugsink.com/) that **writes**, not just reads.

Bugsink's canonical API has always exposed resolve, mute and comment actions —
existing MCP servers only wrap the read half, so an agent can look at an issue but
never close it. This one covers both.

TypeScript, strict.

```
src/
  index.ts          bootstrap: env, server, transport
  api.ts            BugsinkClient + BugsinkApiError
  types.ts          Issue, Project, Paginated<T>, PeriodName
  tools/
    define.ts       the tool contract and the registrar
    index.ts        the registry — the one place a tool becomes reachable
    shared.ts       schemas shared across tools
    meta.ts         test_connection
    projects.ts     project tools
    issues.ts       issue tools
test/               node:test, run against a fake fetch
```

## Adding a tool

Two steps, and the second is one line.

```ts
// src/tools/issues.ts
defineTool({
  name: "delete_issue",
  description:
    "Permanently delete an issue and its stored events. Prefer resolve_issue — this cannot be undone.",
  inputSchema: { issue_id: issueRef },
  annotations: { destructiveHint: true },
  handler: async ({ issue_id }, { client }) =>
    client.request(`/issues/${encodeURIComponent(issue_id)}/`, { method: "DELETE" }),
});
```

Then add it to the array in `src/tools/index.ts`. A tool that is not in that
array does not exist.

What the contract buys you:

- The handler's `input` is inferred from its own `inputSchema`, so the two
  cannot drift.
- A handler returns **data**, never a `CallToolResult`. A `string` renders as a
  message, anything else as pretty JSON.
- A handler never catches. `registerTools` owns the failure boundary, so error
  shaping is decided once instead of once per tool.

### How a failure reads

A **state refusal** — "issue is already resolved", "issue is not muted" — comes
back as a normal result, not an error. The caller's goal is already true, and
raising `isError` there makes an agent retry or escalate something that needs
neither.

Everything else — no access, unknown issue, the instance being down — is an
error, because the agent cannot fix it by rephrasing the call.

## Tools

| tool | |
| --- | --- |
| `test_connection` | check URL + token, list visible projects |
| `list_projects` | resolve a project name to its numeric id |
| `list_issues` | issues of one project, sortable, cursor-paginated |
| `get_issue` | one issue: state, counts, first and last seen |
| `resolve_issue` | mark resolved |
| `resolve_issue_next_release` | resolve in the next release |
| `resolve_issue_latest_release` | resolve in the latest known release |
| `mute_issue` | mute indefinitely |
| `mute_issue_for` | mute for a fixed period |
| `mute_issue_until` | mute until a volume threshold |
| `unmute_issue` | unmute |
| `add_issue_comment` | annotate an issue's history |

## Endpoints (canonical API 0)

```
GET    /api/canonical/0/{teams,projects,issues,events,releases}/
GET    /api/canonical/0/{issues,events,projects,releases}/{id}/
POST   /api/canonical/0/issues/{id}/resolve/
POST   /api/canonical/0/issues/{id}/resolve-next/
POST   /api/canonical/0/issues/{id}/resolve-latest/
POST   /api/canonical/0/issues/{id}/mute/
POST   /api/canonical/0/issues/{id}/mute-for/     {period_name, nr_of_periods}
POST   /api/canonical/0/issues/{id}/mute-until/   {period_name, nr_of_periods, gte_threshold}
POST   /api/canonical/0/issues/{id}/unmute/
POST   /api/canonical/0/issue-comments/           {issue, comment}
PATCH  /api/canonical/0/projects/{id}/
DELETE /api/canonical/0/issues/{id}/
```

`period_name` is one of `year month week day hour minute`. An issue id may be the
UUID or the friendly id (`PROJECT-1234`). `reopen/` exists in current Bugsink but
404s on older builds. Your instance's live schema is at
`/api/canonical/0/schema/swagger-ui/`.

Two things the HTTP layer has to get right, both already handled in `api()`: a
`DELETE` answers `204` with no body and must not go through `res.json()`, and a
bodyless `POST` needs an explicit `Content-Length: 0`.

## Requirements

Node 18+ and a Bugsink API token. An ingest-scoped (`org:ci`) token is enough for
the write actions — the API treats it as a global token, so comments and state
changes are recorded without a user.

## Run

```bash
npm install                 # also builds, via the prepare script
BUGSINK_URL=https://bugsink.example.com BUGSINK_TOKEN=xxx npm start
```

While developing, `npm run dev` runs the sources through `tsx` with no build
step. `npm run typecheck` is the type gate — wider than `npm run build`, because
it also sees the test sources — and `npm test` runs the suite against a fake
fetch, with no network and no instance required. CI runs both.

## Use with Claude Code

```bash
claude mcp add bugsink \
  -e BUGSINK_URL=https://bugsink.example.com \
  -e BUGSINK_TOKEN=xxx \
  -- node /path/to/bugsink-mcp/dist/index.js
```

Any MCP client works — it speaks stdio.

## License

MIT
