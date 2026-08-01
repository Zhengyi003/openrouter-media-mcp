/**
 * Implements the `setup` and `setup --uninstall` CLI flows for the installed
 * MCP server: reads the default VS Code user-level mcp.json, merges or removes
 * this server's entry atomically, and reports what happened.
 *
 * Automatic configuration only targets the Stable desktop build's default
 * local user profile. Users on multi-profile, Remote, Insiders, or other
 * VS Code distributions should configure the server manually instead.
 */

import fs from "node:fs/promises";
import path from "node:path";

import {
  mergeUserMcpConfig,
  removeUserMcpConfig,
  USER_MCP_INSTALL_CONFIG,
} from "./install/user-mcp-config.js";
import { getVSCodeUserConfigPath } from "./install/platform.js";

type SetupOptions = {
  uninstall: boolean;
  configPath?: string;
};

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeJsonFileAtomically(filePath: string, value: Record<string, unknown>): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(tmpPath, filePath);
}

export function parseSetupArgs(args: string[]): SetupOptions {
  const options: SetupOptions = { uninstall: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--uninstall") {
      options.uninstall = true;
    } else if (arg === "--config-path") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--config-path requires a file path argument.");
      }
      options.configPath = value;
      index += 1;
    }
  }
  return options;
}

export async function runSetup(options: SetupOptions): Promise<void> {
  const configPath = options.configPath ?? getVSCodeUserConfigPath();
  const current = await readJsonFile(configPath);

  const next = options.uninstall
    ? removeUserMcpConfig(current)
    : mergeUserMcpConfig(current);

  await writeJsonFileAtomically(configPath, next);

  const serverId = USER_MCP_INSTALL_CONFIG.serverId;
  const action = options.uninstall ? "Removed" : "Installed";
  console.error(
    [
      `${action} user-level MCP server '${serverId}' in ${configPath}.`,
      "Automatic configuration targets the Stable VS Code default user profile.",
      "For multiple profiles or Remote environments, configure manually via",
      "MCP: Open User Configuration or MCP: Open Remote User Configuration.",
    ].join("\n"),
  );
}
