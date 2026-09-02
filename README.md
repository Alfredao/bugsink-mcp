# bugsink-mcp

An MCP server for [Bugsink](https://www.bugsink.com/) that **writes**, not just reads.

Bugsink's canonical API has always exposed resolve, mute and comment actions —
existing MCP servers only wrap the read half, so an agent can look at an issue but
never close it. This one covers both.

TypeScript, strict. Adding a tool means copying `resolve_issue` in
`src/tools/issues.ts` and changing the path.

```
src/
  index.ts          bootstrap: env, server, transport
  api.ts            BugsinkClient + BugsinkApiError
  types.ts          Issue, Project, Paginated<T>, PeriodName
  tools/
    shared.ts       result helpers + the issue-reference schema
    issues.ts       issue tools
```

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
npm install                 # also builds, via the prepare script
BUGSINK_URL=https://bugsink.example.com BUGSINK_TOKEN=xxx npm start
```

While developing, `npm run dev` runs the sources through `tsx` with no build step,
and `npm run typecheck` is the type gate.

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
