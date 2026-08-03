/**
 * Verifies user-level MCP install config merging and removal so the repository
 * can publish one user-scoped server without clobbering unrelated entries.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeUserMcpConfig,
  removeUserMcpConfig,
  USER_MCP_INSTALL_CONFIG,
} from "../src/install/user-mcp-config.js";

test("mergeUserMcpConfig adds this server with the unified CLI command", () => {
  const merged = mergeUserMcpConfig({
    inputs: [
      {
        id: "TAVILY_API_KEY",
        type: "promptString",
      },
    ],
    servers: {
      tavily: {
        type: "stdio",
        command: "npx",
        args: ["tavily-mcp"],
      },
    },
  });

  assert.equal(merged.servers?.tavily?.command, "npx");
  assert.equal(merged.servers?.[USER_MCP_INSTALL_CONFIG.serverId]?.command, "openrouter-image-mcp");
  assert.equal(merged.servers?.[USER_MCP_INSTALL_CONFIG.serverId]?.cwd, undefined);
  assert.equal(
    merged.servers?.[USER_MCP_INSTALL_CONFIG.serverId]?.env?.OPENROUTER_API_KEY,
    `\${input:${USER_MCP_INSTALL_CONFIG.apiKeyInputId}}`,
  );
  assert.deepEqual(
    merged.inputs?.map((input) => input.id),
    [
      "TAVILY_API_KEY",
      USER_MCP_INSTALL_CONFIG.apiKeyInputId,
      USER_MCP_INSTALL_CONFIG.modelInputId,
    ],
  );
  assert.deepEqual(
    merged.inputs?.find((input) => input.id === USER_MCP_INSTALL_CONFIG.modelInputId)?.options,
    ["openai/gpt-image-2", "google/gemini-3.1-flash-image"],
  );
  assert.equal(
    merged.inputs?.find((input) => input.id === USER_MCP_INSTALL_CONFIG.modelInputId)?.default,
    "openai/gpt-image-2",
  );
});

test("removeUserMcpConfig removes only this server and its related inputs", () => {
  const cleaned = removeUserMcpConfig({
    inputs: [
      {
        id: USER_MCP_INSTALL_CONFIG.apiKeyInputId,
        type: "promptString",
      },
      {
        id: USER_MCP_INSTALL_CONFIG.modelInputId,
        type: "pickString",
      },
      {
        id: "TAVILY_API_KEY",
        type: "promptString",
      },
    ],
    servers: {
      [USER_MCP_INSTALL_CONFIG.serverId]: {
        type: "stdio",
        command: "node",
      },
      tavily: {
        type: "stdio",
        command: "npx",
      },
    },
  });

  assert.equal(cleaned.servers?.[USER_MCP_INSTALL_CONFIG.serverId], undefined);
  assert.equal(cleaned.servers?.tavily?.command, "npx");
  assert.deepEqual(cleaned.inputs?.map((input) => input.id), ["TAVILY_API_KEY"]);
});

test("mergeUserMcpConfig keeps unrelated entries when the config is minimal", () => {
  const merged = mergeUserMcpConfig({});

  assert.equal(merged.servers?.[USER_MCP_INSTALL_CONFIG.serverId]?.command, "openrouter-image-mcp");
  assert.equal(merged.inputs?.length, 2);
});