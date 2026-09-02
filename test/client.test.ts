import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BugsinkApiError, BugsinkClient } from "../src/api.js";

interface Recorded {
  url: string;
  init: RequestInit;
}

/** Statuses the fetch spec forbids a body on — even an empty string throws. */
const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** A fetch stand-in that records the call and replays a canned response. */
function fakeFetch(response: { status: number; body: string }, log: Recorded[] = []) {
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    log.push({ url: String(url), init });
    const body = NULL_BODY_STATUSES.has(response.status) ? null : response.body;
    return new Response(body, { status: response.status });
  }) as unknown as typeof fetch;
  return { impl, log };
}

function client(response: { status: number; body: string }) {
  const { impl, log } = fakeFetch(response);
  return { client: new BugsinkClient({ url: "https://bugsink.test/", token: "t", fetchImpl: impl }), log };
}

describe("BugsinkClient", () => {
  it("strips a trailing slash from the base URL and targets the canonical API", async () => {
    const { client: c, log } = client({ status: 200, body: '{"results":[]}' });
    await c.listProjects();
    assert.equal(log[0]?.url, "https://bugsink.test/api/canonical/0/projects/");
  });

  it("sends the bearer token", async () => {
    const { client: c, log } = client({ status: 200, body: '{"results":[]}' });
    await c.listProjects();
    const headers = log[0]?.init.headers as Record<string, string>;
    assert.equal(headers["Authorization"], "Bearer t");
  });

  it("sets Content-Length on a bodyless POST, which Bugsink requires", async () => {
    const { client: c, log } = client({ status: 200, body: "{}" });
    await c.issueAction("PROJECT-1", "resolve");
    const headers = log[0]?.init.headers as Record<string, string>;
    assert.equal(headers["Content-Length"], "0");
    assert.equal(log[0]?.init.body, undefined);
  });

  it("does not set Content-Length when there is a body", async () => {
    const { client: c, log } = client({ status: 200, body: "{}" });
    await c.issueAction("PROJECT-1", "mute-for", { period_name: "week", nr_of_periods: 2 });
    const headers = log[0]?.init.headers as Record<string, string>;
    assert.equal(headers["Content-Length"], undefined);
    assert.equal(log[0]?.init.body, '{"period_name":"week","nr_of_periods":2}');
  });

  it("survives a 204 with no body instead of failing to parse it", async () => {
    const { client: c } = client({ status: 204, body: "" });
    assert.deepEqual(await c.request("/issues/x/", { method: "DELETE" }), { ok: true, status: 204 });
  });

  it("percent-encodes the issue reference", async () => {
    const { client: c, log } = client({ status: 200, body: "{}" });
    await c.getIssue("PROJECT 1/../x");
    assert.ok(log[0]?.url.endsWith("/issues/PROJECT%201%2F..%2Fx/"));
  });

  it("builds the list query with only the params that were given", async () => {
    const { client: c, log } = client({ status: 200, body: '{"results":[]}' });
    await c.listIssues({ project: 7, sort: "last_seen" });
    assert.ok(log[0]?.url.endsWith("/issues/?project=7&sort=last_seen"));
  });

  it("raises BugsinkApiError carrying the status and the parsed detail", async () => {
    const { client: c } = client({ status: 400, body: '{"detail":"Issue is already resolved."}' });
    await assert.rejects(
      () => c.issueAction("PROJECT-1", "resolve"),
      (error: unknown) => {
        assert.ok(error instanceof BugsinkApiError);
        assert.equal(error.status, 400);
        assert.equal(error.detail, "Issue is already resolved.");
        assert.equal(error.isStateRefusal, true);
        return true;
      },
    );
  });

  it("falls back to the raw body when the error is not JSON", async () => {
    const { client: c } = client({ status: 502, body: "<html>bad gateway</html>" });
    await assert.rejects(
      () => c.listProjects(),
      (error: unknown) => {
        assert.ok(error instanceof BugsinkApiError);
        assert.equal(error.detail, "<html>bad gateway</html>");
        assert.equal(error.isStateRefusal, false);
        return true;
      },
    );
  });

  it("puts the required issue filter on the events query, which the API 400s without", async () => {
    const { client: c, log } = client({ status: 200, body: '{"results":[]}' });
    await c.listEvents({ issue: "PROJECT-914" });
    assert.equal(log[0]?.url, "https://bugsink.test/api/canonical/0/events/?issue=PROJECT-914");
  });

  it("carries a cursor through to the next events page", async () => {
    const { client: c, log } = client({ status: 200, body: '{"results":[]}' });
    await c.listEvents({ issue: "PROJECT-914", cursor: "cD0x" });
    assert.match(String(log[0]?.url), /issue=PROJECT-914&cursor=cD0x/);
  });

  it("reads one event by its Bugsink id", async () => {
    const { client: c, log } = client({ status: 200, body: "{}" });
    await c.getEvent("91b7eeab-4c68-42db-a965-46126dd98533");
    assert.equal(
      log[0]?.url,
      "https://bugsink.test/api/canonical/0/events/91b7eeab-4c68-42db-a965-46126dd98533/",
    );
  });
});
