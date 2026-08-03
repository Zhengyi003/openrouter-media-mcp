#!/usr/bin/env node
/**
 * Entry point for the OpenRouter image MCP distribution.
 *
 * With no arguments it starts the MCP server over stdio. With `setup` or
 * `setup --uninstall` it manages the VS Code user-level mcp.json entry so a
 * Homebrew or npm install can converge on the same configuration shape.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { parseSetupArgs, runSetup } from "./cli-setup.js";
import { loadConfig } from "./config.js";
import { registerLongCallDiagnostic } from "./tools/diagnose-long-call.js";
import { registerGenerateImage } from "./tools/generate-image.js";

export function createServer(): McpServer {
  const config = loadConfig();
  const server = new McpServer({
    name: "openrouter-image-mcp",
    version: "0.1.1",
  });

  registerGenerateImage(server, config);

  if (config.diagnosticsEnabled) {
    registerLongCallDiagnostic(server);
  }

  return server;
}

async function main(): Promise<void> {
  if (process.argv[2] === "setup") {
    const options = parseSetupArgs(process.argv.slice(3));
    await runSetup(options);
    return;
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  console.error(`OpenRouter image MCP failed: ${message}`);
  process.exitCode = 1;
});