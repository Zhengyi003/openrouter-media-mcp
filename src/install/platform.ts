/**
 * Resolves the VS Code user-level mcp.json path for the current platform.
 *
 * Only the Stable desktop build's default local user profile is supported by
 * automatic configuration. Multi-profile, Remote, Insiders, and other VS Code
 * distributions are intentionally out of scope here; their configuration must
 * be opened manually from within VS Code.
 */

import os from "node:os";
import path from "node:path";

export function getVSCodeUserConfigPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  switch (platform) {
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support", "Code", "User", "mcp.json");
    case "linux":
      return path.join(os.homedir(), ".config", "Code", "User", "mcp.json");
    case "win32": {
      const appData = env.APPDATA;
      if (!appData) {
        throw new Error("APPDATA is not set; cannot locate the VS Code user configuration.");
      }
      return path.join(appData, "Code", "User", "mcp.json");
    }
    default:
      throw new Error(`Unsupported platform for automatic MCP configuration: ${platform}`);
  }
}
