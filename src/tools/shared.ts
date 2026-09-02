import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Tools answer with the raw JSON, so nothing is lost to a summary. */
export function json(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function text(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }] };
}

/** Bugsink accepts either the UUID or the friendly id, e.g. PROJECT-1234. */
export const issueRef = z.string().min(1).describe("Issue UUID or friendly ID (e.g. PROJECT-1234)");
