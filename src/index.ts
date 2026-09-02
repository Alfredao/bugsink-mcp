#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BugsinkClient } from "./api.js";
import { registerTools, tools } from "./tools/index.js";

const url = process.env["BUGSINK_URL"];
const token = process.env["BUGSINK_TOKEN"];

if (!url || !token) {
  console.error("bugsink-mcp: BUGSINK_URL and BUGSINK_TOKEN are required");
  process.exit(1);
}

const server = new McpServer({ name: "bugsink", version: "0.3.0" });

registerTools(server, tools, { client: new BugsinkClient({ url, token }) });

await server.connect(new StdioServerTransport());
