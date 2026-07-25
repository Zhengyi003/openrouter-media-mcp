/**
 * Removes this MCP server from VS Code's user-level mcp.json so ordinary-user
 * installation can be cleanly tested without stale registrations.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  removeUserMcpConfig,
  USER_MCP_INSTALL_CONFIG,
} from "../dist/install/user-mcp-config.js";

const userConfigPath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Code",
  "User",
  "mcp.json",
);

async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function main() {
  const currentConfig = await readJsonFile(userConfigPath);
  const nextConfig = removeUserMcpConfig(currentConfig);

  await fs.mkdir(path.dirname(userConfigPath), { recursive: true });
  await fs.writeFile(`${userConfigPath}.tmp`, `${JSON.stringify(nextConfig, null, 2)}\n`);
  await fs.rename(`${userConfigPath}.tmp`, userConfigPath);

  console.error(
    `Removed user-level MCP server '${USER_MCP_INSTALL_CONFIG.serverId}' if it was present.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown uninstall error";
  console.error(`Failed to uninstall user-level MCP config: ${message}`);
  process.exitCode = 1;
});