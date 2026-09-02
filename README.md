# bugsink-mcp

An MCP server for [Bugsink](https://www.bugsink.com/) that **writes**, not just reads.

Bugsink's canonical API has always exposed resolve, mute and comment actions —
existing MCP servers only wrap the read half, so an agent can look at an issue but
never close it. This one covers both.

Everything lives in one file, `src/index.js`. Adding a tool means copying
`resolve_issue` and changing the path.

## Status

Early. Three tools so far — `test_connection`, `list_issues`, `resolve_issue` — and
the endpoint map below to grow into.

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
npm install
BUGSINK_URL=https://bugsink.example.com BUGSINK_TOKEN=xxx npm start
```

## Use with Claude Code

```bash
claude mcp add bugsink \
  -e BUGSINK_URL=https://bugsink.example.com \
  -e BUGSINK_TOKEN=xxx \
  -- node /path/to/bugsink-mcp/src/index.js
```

Any MCP client works — it speaks stdio.

## License

MIT
