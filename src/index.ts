#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BugsinkClient } from "./api.js";
import { registerIssueTools } from "./tools/issues.js";
import { text } from "./tools/shared.js";

const url = process.env["BUGSINK_URL"];
const token = process.env["BUGSINK_TOKEN"];

if (!url || !token) {
  console.error("bugsink-mcp: BUGSINK_URL and BUGSINK_TOKEN are required");
  process.exit(1);
}

const client = new BugsinkClient({ url, token });
const server = new McpServer({ name: "bugsink", version: "0.2.0" });

server.registerTool(
  "test_connection",
  { description: "Check that the Bugsink URL and token work.", inputSchema: {} },
  async () => {
    const { results } = await client.listProjects();
    const projects = results.map((p) => `${p.id}:${p.slug}`).join(", ");
    return text(`Connected to ${url}. Projects: ${projects || "none"}`);
  },
);

registerIssueTools(server, client);

await server.connect(new StdioServerTransport());
