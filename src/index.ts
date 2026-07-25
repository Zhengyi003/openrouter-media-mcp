#!/usr/bin/env node
/**
 * Starts the OpenRouter image MCP server over stdio.
 * Registration stays centralized here so the published tool surface remains
 * explicit and development-only diagnostics cannot leak into normal use.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { registerLongCallDiagnostic } from "./tools/diagnose-long-call.js";
import { registerGenerateImage } from "./tools/generate-image.js";

export function createServer(): McpServer {
  const config = loadConfig();
  const server = new McpServer({
    name: "openrouter-image-mcp",
    version: "0.1.0",
  });

  registerGenerateImage(server, config);

  if (config.diagnosticsEnabled) {
    registerLongCallDiagnostic(server);
  }

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  console.error(`OpenRouter image MCP failed: ${message}`);
  process.exitCode = 1;
});