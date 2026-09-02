import type { z, ZodRawShape } from "zod";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BugsinkClient } from "../api.js";

/** Everything a tool handler is allowed to reach. Grows here, never per tool. */
export interface ToolContext {
  client: BugsinkClient;
}

/** The parsed input a handler receives, derived from its own schema. */
type Input<Shape extends ZodRawShape> = z.infer<z.ZodObject<Shape>>;

/**
 * What a handler returns, and how it is rendered:
 * a `string` becomes a text message, anything else becomes pretty JSON.
 * Handlers never build a `CallToolResult` themselves — that is the registrar's
 * job, so error shaping cannot be re-decided one tool at a time.
 */
export type ToolOutput = string | object;

export interface ToolDefinition<Shape extends ZodRawShape = ZodRawShape> {
  /** Unique, snake_case. This is the name an agent calls. */
  name: string;
  /**
   * Written for an agent deciding whether to call this. Say what it does AND
   * when to reach for it; the wire format is discoverable, the intent is not.
   */
  description: string;
  inputSchema: Shape;
  annotations?: ToolAnnotations;
  handler: (input: Input<Shape>, ctx: ToolContext) => Promise<ToolOutput>;
}

/**
 * Identity function that pins `Shape` at the definition site, so a handler's
 * parameter is inferred from its own `inputSchema` and the two cannot drift.
 */
export function defineTool<Shape extends ZodRawShape>(def: ToolDefinition<Shape>): ToolDefinition<Shape> {
  return def;
}

/**
 * The registry is heterogeneous — every tool has a different schema — so the
 * array element type has to erase `Shape`. The looseness is confined to this
 * alias; each tool keeps full inference where it is defined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any>;

export function render(output: ToolOutput): CallToolResult {
  const text = typeof output === "string" ? output : JSON.stringify(output, null, 2);
  return { content: [{ type: "text", text }] };
}

export function registerTools(server: McpServer, tools: AnyToolDefinition[], ctx: ToolContext): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      },
      async (input: unknown) => render(await tool.handler(input as never, ctx)),
    );
  }
}
