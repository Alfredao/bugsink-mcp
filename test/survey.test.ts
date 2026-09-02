import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cursorFrom, matchesState, surveyIssues, toRow } from "../src/survey.js";
import type { Issue, Paginated } from "../src/types.js";

const NOW = new Date("2026-09-02T12:00:00Z");

function issue(over: Partial<Issue> = {}): Issue {
  return {
    id: "uuid",
    friendly_id: "P-1",
    project: 1,
    digest_order: 1,
    first_seen: "2026-08-01T00:00:00Z",
    last_seen: "2026-09-02T00:00:00Z",
    digested_event_count: 10,
    stored_event_count: 10,
    calculated_type: "TypeError",
    calculated_value: "boom",
    transaction: "",
    is_resolved: false,
    is_resolved_by_next_release: false,
    is_muted: false,
    ...over,
  };
}

function page(results: Issue[], next: string | null = null): Paginated<Issue> {
  return { next, previous: null, results };
}

const OPTIONS = { days: 7, state: "unresolved" as const, minEvents: 0, limit: 60, maxPages: 8, now: NOW };

describe("matchesState", () => {
  it("treats an issue as unresolved only when it is neither resolved nor muted", () => {
    assert.equal(matchesState(issue(), "unresolved"), true);
    assert.equal(matchesState(issue({ is_resolved: true }), "unresolved"), false);
    assert.equal(matchesState(issue({ is_muted: true }), "unresolved"), false);
  });

  it("keeps everything under all, which is the only state that does not filter", () => {
    for (const i of [issue(), issue({ is_resolved: true }), issue({ is_muted: true })]) {
      assert.equal(matchesState(i, "all"), true);
    }
  });
});

describe("surveyIssues", () => {
  it("drops issues the API would have returned despite a state filter", async () => {
    // The measured API behaviour: a state filter is ignored, so the page mixes
    // resolved rows in. If this stops filtering, a resolved backlog reads live.
    const result = await surveyIssues(
      async () => page([issue({ friendly_id: "P-1" }), issue({ friendly_id: "P-2", is_resolved: true })]),
      OPTIONS,
    );
    assert.deepEqual(
      result.issues.map((r) => r.id),
      ["P-1"],
    );
    assert.equal(result.scanned, 2);
  });

  it("stops paging at the first issue outside the window, because the fetch is newest-first", async () => {
    let calls = 0;
    const result = await surveyIssues(async () => {
      calls += 1;
      return page(
        [issue({ friendly_id: `P-${calls}`, last_seen: calls === 1 ? "2026-09-01T00:00:00Z" : "2026-01-01T00:00:00Z" })],
        "https://b.test/api/canonical/0/issues/?cursor=next",
      );
    }, OPTIONS);
    assert.equal(calls, 2, "should have stopped once a page fell out of the window");
    assert.equal(result.complete, true);
    assert.deepEqual(
      result.issues.map((r) => r.id),
      ["P-1"],
    );
  });

  it("honours the page cap and says the answer is partial", async () => {
    const result = await surveyIssues(
      async () => page([issue()], "https://b.test/api/canonical/0/issues/?cursor=more"),
      { ...OPTIONS, maxPages: 2 },
    );
    assert.equal(result.pages, 2);
    assert.equal(result.complete, false);
    assert.match(result.note ?? "", /not all of them/);
  });

  it("orders by event count and reports what it left out", async () => {
    const result = await surveyIssues(
      async () =>
        page([
          issue({ friendly_id: "small", stored_event_count: 1 }),
          issue({ friendly_id: "big", stored_event_count: 99 }),
        ]),
      { ...OPTIONS, limit: 1 },
    );
    assert.deepEqual(
      result.issues.map((r) => r.id),
      ["big"],
    );
    assert.equal(result.matched, 2);
    assert.match(result.note ?? "", /1 more/);
  });

  it("applies the event floor", async () => {
    const result = await surveyIssues(
      async () => page([issue({ friendly_id: "quiet", stored_event_count: 2 })]),
      { ...OPTIONS, minEvents: 3 },
    );
    assert.equal(result.issues.length, 0);
  });
});

describe("toRow", () => {
  it("distinguishes a next-release resolution from a plain one", () => {
    assert.equal(toRow(issue({ is_resolved: true, is_resolved_by_next_release: true })).state, "resolved:next-release");
    assert.equal(toRow(issue({ is_resolved: true })).state, "resolved");
    assert.equal(toRow(issue({ is_muted: true })).state, "muted");
    assert.equal(toRow(issue()).state, "open");
  });

  it("truncates a long value instead of carrying a wall of text per row", () => {
    const row = toRow(issue({ calculated_value: "x".repeat(400) }));
    assert.ok(row.value.length < 130, row.value.length.toString());
    assert.ok(row.value.endsWith("…"));
  });
});

describe("cursorFrom", () => {
  it("pulls the cursor out of the next URL", () => {
    assert.equal(cursorFrom("https://b.test/api/canonical/0/issues/?cursor=cD0x&project=1"), "cD0x");
  });

  it("answers undefined on the last page or a URL it cannot parse", () => {
    assert.equal(cursorFrom(null), undefined);
    assert.equal(cursorFrom("not a url"), undefined);
  });
});
