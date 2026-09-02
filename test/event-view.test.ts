import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appFrames, locate, summarizeEvent } from "../src/event-view.js";
import type { EventDetail, StackFrame } from "../src/types.js";

function event(frames: StackFrame[] = [], data: Record<string, unknown> = {}): EventDetail {
  return {
    id: "bugsink-id",
    event_id: "sdk-id",
    issue: "issue-uuid",
    project: 1,
    grouping: 1,
    timestamp: "2026-09-02T01:01:07Z",
    ingested_at: "2026-09-02T01:01:07Z",
    digested_at: "2026-09-02T01:01:09Z",
    digest_order: 1,
    stacktrace_md: "# InvalidRequest\nrendered",
    data: {
      level: "error",
      environment: "production",
      exception: { values: [{ type: "TypeError", value: "boom", stacktrace: { frames } }] },
      ...data,
    },
  };
}

describe("appFrames", () => {
  it("drops node_modules and Node builtins, which is where the top of a stack usually is", () => {
    const frames = [
      { filename: "/app/lib/audit/chain.ts", lineno: 42, function: "seal" },
      { filename: "/app/node_modules/@aws-sdk/core/index.js", lineno: 1, function: "send" },
      { filename: "node:internal/process/task_queues", lineno: 103, function: "tick" },
    ];
    assert.deepEqual(appFrames(event(frames)), ["/app/lib/audit/chain.ts:42 in seal"]);
  });

  it("returns the throw site first, reversing the payload's oldest-first order", () => {
    const frames = [
      { filename: "/app/a.ts", lineno: 1, function: "outer" },
      { filename: "/app/b.ts", lineno: 2, function: "inner" },
    ];
    assert.deepEqual(appFrames(event(frames)), ["/app/b.ts:2 in inner", "/app/a.ts:1 in outer"]);
  });

  it("answers empty when every frame is vendor code, rather than pretending", () => {
    assert.deepEqual(appFrames(event([{ filename: "/app/node_modules/x/i.js", lineno: 9 }])), []);
  });

  it("survives an event with no stacktrace at all", () => {
    const bare = event();
    delete bare.data.exception;
    assert.deepEqual(appFrames(bare), []);
  });
});

describe("locate", () => {
  it("prefers the request URL, then the Next.js request path, then the transaction", () => {
    assert.equal(locate(event([], { request: { url: "https://x.test/api/a" } })), "https://x.test/api/a");
    assert.equal(locate(event([], { contexts: { nextjs: { request_path: "/api/b" } } })), "/api/b");
    assert.equal(locate(event([], { transaction: "GET /c" })), "GET /c");
    assert.equal(locate(event()), undefined);
  });
});

describe("summarizeEvent", () => {
  it("keeps the rendered stacktrace but omits the heavy sections by default", () => {
    const summary = summarizeEvent(event([], { breadcrumbs: ["huge"], modules: { a: "1" } })) as Record<string, unknown>;
    assert.equal(summary["stacktrace_md"], "# InvalidRequest\nrendered");
    assert.equal("breadcrumbs" in summary, false);
    assert.equal("modules" in summary, false);
  });

  it("includes a section only when asked", () => {
    const summary = summarizeEvent(event([], { breadcrumbs: ["one"] }), ["breadcrumbs"]) as Record<string, unknown>;
    assert.deepEqual(summary["breadcrumbs"], ["one"]);
  });

  it("returns the untouched payload for raw, because a summary can drop what mattered", () => {
    const source = event();
    assert.equal(summarizeEvent(source, ["raw"]), source);
  });

  it("says so when no frame belongs to us, instead of showing an empty list", () => {
    const summary = summarizeEvent(event([{ filename: "/app/node_modules/x/i.js" }])) as Record<string, unknown>;
    assert.match(String(summary["app_frames_note"]), /did not pass through our code/);
  });

  it("omits the note when we do have frames, so it never reads as a caveat on a good answer", () => {
    const summary = summarizeEvent(event([{ filename: "/app/a.ts", lineno: 1 }])) as Record<string, unknown>;
    assert.equal("app_frames_note" in summary, false);
  });

  it("falls back to the log message when there is no exception value", () => {
    const logged = event();
    delete logged.data.exception;
    logged.data.logentry = { formatted: "AI insight cache stale for business 94" };
    const summary = summarizeEvent(logged) as Record<string, unknown>;
    assert.equal(summary["value"], "AI insight cache stale for business 94");
  });
});
