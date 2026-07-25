/**
 * Installs this MCP server into VS Code's user-level mcp.json so it appears
 * as a user-scoped server instead of a workspace-scoped development server.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import {
  mergeUserMcpConfig,
  USER_MCP_INSTALL_CONFIG,
} from "../dist/install/user-mcp-config.js";

const repoRoot = path.resolve(process.cwd());
const userConfigPath = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "Code",
  "User",
  "mcp.json",
);
const distEntryPath = path.join(repoRoot, "dist", "index.js");

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
  await fs.access(distEntryPath);
  const currentConfig = await readJsonFile(userConfigPath);
  const nextConfig = mergeUserMcpConfig(currentConfig, repoRoot);

  await fs.mkdir(path.dirname(userConfigPath), { recursive: true });
  await fs.writeFile(`${userConfigPath}.tmp`, `${JSON.stringify(nextConfig, null, 2)}\n`);
  await fs.rename(`${userConfigPath}.tmp`, userConfigPath);

  console.error(
    [
      `Installed user-level MCP server '${USER_MCP_INSTALL_CONFIG.serverId}'.`,
      "If this repository also has .vscode/mcp.json enabled, disable it to avoid duplicate registration.",
    ].join(" "),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown install error";
  console.error(`Failed to install user-level MCP config: ${message}`);
  process.exitCode = 1;
});