import type { AnyToolDefinition } from "./define.js";
import { issueTools } from "./issues.js";
import { metaTools } from "./meta.js";

/**
 * The one place a tool becomes reachable. A tool that is not in this array does
 * not exist, which is what keeps registration from drifting per file.
 */
export const tools: AnyToolDefinition[] = [...metaTools, ...issueTools];

export { defineTool, registerTools, render } from "./define.js";
export type { AnyToolDefinition, ToolContext, ToolDefinition } from "./define.js";
