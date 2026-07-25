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

test("mergeUserMcpConfig adds this server without removing unrelated entries", () => {
  const merged = mergeUserMcpConfig(
    {
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
    },
    "/tmp/openrouter-mcp",
  );

  assert.equal(merged.servers?.tavily?.command, "npx");
  assert.equal(merged.servers?.[USER_MCP_INSTALL_CONFIG.serverId]?.cwd, "/tmp/openrouter-mcp");
  assert.deepEqual(
    merged.inputs?.map((input) => input.id),
    [
      "TAVILY_API_KEY",
      USER_MCP_INSTALL_CONFIG.apiKeyInputId,
      USER_MCP_INSTALL_CONFIG.modelInputId,
    ],
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