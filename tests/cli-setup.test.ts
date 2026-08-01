/**
 * Verifies the setup CLI flow: argument parsing, atomic merge, and uninstall
 * removal against a real temporary mcp.json file.
 */

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseSetupArgs, runSetup } from "../src/cli-setup.js";
import {
  USER_MCP_INSTALL_CONFIG,
  type McpConfigFile,
} from "../src/install/user-mcp-config.js";

async function writeConfig(configPath: string, content: unknown): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(content));
}

async function readConfig(configPath: string): Promise<McpConfigFile> {
  return JSON.parse(await fs.readFile(configPath, "utf8")) as McpConfigFile;
}

test("parseSetupArgs handles uninstall and config-path flags", () => {
  assert.deepEqual(parseSetupArgs([]), { uninstall: false });
  assert.deepEqual(parseSetupArgs(["--uninstall"]), { uninstall: true });
  assert.deepEqual(parseSetupArgs(["--config-path", "/tmp/a.json"]), {
    uninstall: false,
    configPath: "/tmp/a.json",
  });
  assert.deepEqual(parseSetupArgs(["--config-path", "/tmp/a.json", "--uninstall"]), {
    uninstall: true,
    configPath: "/tmp/a.json",
  });
});

test("parseSetupArgs rejects a config-path flag without a value", () => {
  assert.throws(() => parseSetupArgs(["--config-path"]), /requires a file path/);
});

test("runSetup creates the config and preserves unrelated servers", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-setup-"));
  const configPath = path.join(dir, "mcp.json");
  await writeConfig(configPath, {
    inputs: [{ id: "TAVILY_API_KEY", type: "promptString" }],
    servers: {
      tavily: { type: "stdio", command: "npx", args: ["tavily-mcp"] },
    },
  });

  await runSetup({ uninstall: false, configPath });

  const merged = await readConfig(configPath);
  assert.equal(merged.servers?.tavily?.command, "npx");
  assert.equal(merged.servers?.[USER_MCP_INSTALL_CONFIG.serverId]?.command, "openrouter-image-mcp");
  assert.equal(merged.inputs?.length, 3);
});

test("runSetup creates the file when it does not exist", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-setup-"));
  const configPath = path.join(dir, "mcp.json");

  await runSetup({ uninstall: false, configPath });

  const merged = await readConfig(configPath);
  assert.equal(merged.servers?.[USER_MCP_INSTALL_CONFIG.serverId]?.command, "openrouter-image-mcp");
  assert.equal(merged.inputs?.length, 2);
});

test("runSetup uninstall removes only this server and its inputs", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-setup-"));
  const configPath = path.join(dir, "mcp.json");
  await writeConfig(configPath, {
    inputs: [
      { id: USER_MCP_INSTALL_CONFIG.apiKeyInputId, type: "promptString" },
      { id: USER_MCP_INSTALL_CONFIG.modelInputId, type: "pickString" },
      { id: "TAVILY_API_KEY", type: "promptString" },
    ],
    servers: {
      [USER_MCP_INSTALL_CONFIG.serverId]: { type: "stdio", command: "openrouter-image-mcp" },
      tavily: { type: "stdio", command: "npx" },
    },
  });

  await runSetup({ uninstall: true, configPath });

  const cleaned = await readConfig(configPath);
  assert.equal(cleaned.servers?.[USER_MCP_INSTALL_CONFIG.serverId], undefined);
  assert.equal(cleaned.servers?.tavily?.command, "npx");
  assert.deepEqual(
    (cleaned.inputs as Array<{ id: string }>)?.map((input) => input.id),
    ["TAVILY_API_KEY"],
  );
});

test("runSetup uninstall is idempotent when the config file does not exist", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-setup-"));
  const configPath = path.join(dir, "missing", "mcp.json");

  await runSetup({ uninstall: true, configPath });

  const cleaned = await readConfig(configPath);
  assert.equal(cleaned.servers?.[USER_MCP_INSTALL_CONFIG.serverId], undefined);
});
