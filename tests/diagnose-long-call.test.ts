/**
 * Verifies the development-only long-call probe through an in-memory MCP client
 * so progress and cancellation are exercised at the protocol boundary.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerLongCallDiagnostic } from "../src/tools/diagnose-long-call.js";

async function createConnectedPair(): Promise<{
  client: Client;
  server: McpServer;
}> {
  const server = new McpServer({ name: "diagnostic-test", version: "0.1.0" });
  registerLongCallDiagnostic(server);

  const client = new Client({ name: "diagnostic-test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return { client, server };
}

test("diagnostic returns a final result and emits progress", async (context) => {
  const { client, server } = await createConnectedPair();
  context.after(async () => {
    await client.close();
    await server.close();
  });

  const progressValues: number[] = [];
  const result = await client.callTool(
    { name: "diagnose_long_call", arguments: { seconds: 1 } },
    undefined,
    {
      timeout: 3_000,
      onprogress: ({ progress }) => progressValues.push(progress),
    },
  );

  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, {
    elapsedSeconds: 1,
    completed: true,
  });
  assert.deepEqual(progressValues, [1]);
});

test("diagnostic honors client cancellation", async (context) => {
  const { client, server } = await createConnectedPair();
  context.after(async () => {
    await client.close();
    await server.close();
  });

  const controller = new AbortController();
  const call = client.callTool(
    { name: "diagnose_long_call", arguments: { seconds: 5 } },
    undefined,
    { signal: controller.signal, timeout: 7_000 },
  );
  setTimeout(() => controller.abort(), 25);

  await assert.rejects(call, {
    name: "McpError",
    message: /AbortError: This operation was aborted/,
  });
});