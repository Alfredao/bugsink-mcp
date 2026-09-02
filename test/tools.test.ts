import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BugsinkApiError } from "../src/api.js";
import { render, renderError } from "../src/tools/define.js";
import { tools } from "../src/tools/index.js";

/**
 * A result carries a union of content blocks. Narrowing here instead of casting
 * also asserts the thing the union allows us to get wrong: that we emit text.
 */
function firstText(result: CallToolResult): string {
  const block = result.content[0];
  if (block?.type !== "text") throw new Error(`expected a text block, got ${block?.type ?? "nothing"}`);
  return block.text;
}

describe("the registry", () => {
  it("registers every tool under a unique name", () => {
    const names = tools.map((t) => t.name);
    assert.equal(new Set(names).size, names.length, `duplicate tool name in ${names.join(", ")}`);
  });

  it("names every tool in snake_case, which is what the agent types", () => {
    for (const tool of tools) assert.match(tool.name, /^[a-z][a-z0-9_]*$/, tool.name);
  });

  it("gives every tool a description long enough to say when to use it", () => {
    for (const tool of tools) {
      assert.ok(tool.description.length >= 40, `${tool.name} has a thin description`);
    }
  });

  it("gives every tool an input schema object", () => {
    for (const tool of tools) assert.equal(typeof tool.inputSchema, "object", tool.name);
  });

  it("marks every read-only tool as such, so a client can offer it without a prompt", () => {
    const reads = tools.filter((t) => t.name.startsWith("list_") || t.name.startsWith("get_"));
    assert.ok(reads.length > 0);
    for (const tool of reads) {
      assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} is missing readOnlyHint`);
    }
  });
});

describe("render", () => {
  it("renders a string as a message", () => {
    assert.deepEqual(render("hello"), { content: [{ type: "text", text: "hello" }] });
  });

  it("renders anything else as pretty JSON", () => {
    assert.equal(firstText(render({ id: 1 })), '{\n  "id": 1\n}');
  });
});

describe("renderError", () => {
  it("treats a state refusal as an answer, so an agent does not retry a goal already met", () => {
    const result = renderError(new BugsinkApiError(400, '{"detail":"Issue is already resolved."}'));
    assert.equal(result.isError, undefined);
    assert.equal(firstText(result), "Bugsink declined: Issue is already resolved.");
  });

  it("treats a missing issue as an error, because the agent has to change the call", () => {
    const result = renderError(new BugsinkApiError(404, '{"detail":"No Issue matches the given query."}'));
    assert.equal(result.isError, true);
    assert.match(firstText(result), /^Bugsink error 404: /);
  });

  it("treats the instance being down as an error", () => {
    assert.equal(renderError(new BugsinkApiError(503, "unavailable")).isError, true);
  });

  it("does not leak a non-API failure as a success", () => {
    const result = renderError(new TypeError("fetch failed"));
    assert.equal(result.isError, true);
    assert.match(firstText(result), /fetch failed/);
  });
});
