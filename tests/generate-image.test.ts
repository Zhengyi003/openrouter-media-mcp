/**
 * Exercises generate_image through an in-memory MCP client with a fake
 * OpenRouter boundary, ensuring no test can incur image-generation charges.
 */

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

import type { ServerConfig } from "../src/config.js";
import type {
  GenerateImageRequest,
  GenerateImageResponse,
  ImageEndpointsResponse,
} from "../src/openrouter/types.js";
import {
  registerGenerateImage,
  type ImageApiClient,
} from "../src/tools/generate-image.js";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";

const config: ServerConfig = {
  apiKey: "test-key",
  defaultModel: "openai/gpt-image-2",
  diagnosticsEnabled: false,
  requestTimeoutMs: 5_000,
};

class FakeImageClient implements ImageApiClient {
  readonly generatedPayloads: GenerateImageRequest[] = [];

  constructor(
    private readonly supportedParameters: ImageEndpointsResponse["endpoints"][number]["supported_parameters"] = {
      output_format: { type: "enum", values: ["png", "jpeg"] },
      input_references: { type: "range", min: 0, max: 4 },
      seed: { type: "boolean" },
      quality: { type: "enum", values: ["auto", "low", "medium", "high"] },
      resolution: { type: "enum", values: ["512", "1K", "2K", "4K"] },
    },
  ) {}

  async getImageEndpoints(model: string): Promise<ImageEndpointsResponse> {
    return {
      id: model,
      endpoints: [
        {
          provider_name: "Test Provider",
          provider_slug: "test",
          provider_tag: "test",
          supported_parameters: this.supportedParameters,
          supports_streaming: false,
          pricing: [],
        },
      ],
    };
  }

  async generateImage(
    payload: GenerateImageRequest,
  ): Promise<GenerateImageResponse> {
    this.generatedPayloads.push(payload);
    return {
      created: 1,
      data: [{ b64_json: PNG_BASE64, media_type: "image/png" }],
      usage: { cost: 0.014 },
    };
  }
}

async function createConnectedPair(fakeClient: FakeImageClient): Promise<{
  client: Client;
  server: McpServer;
}> {
  const server = new McpServer({ name: "generate-test", version: "0.1.0" });
  registerGenerateImage(server, config, () => fakeClient);
  const client = new Client({ name: "generate-test-client", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

test("uses installed default model and returns image plus saved file", async (context) => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "image-mcp-test-"));
  const fakeClient = new FakeImageClient();
  const { client, server } = await createConnectedPair(fakeClient);
  context.after(async () => {
    await client.close();
    await server.close();
    await rm(outputDirectory, { recursive: true, force: true });
  });

  const result = await client.callTool(
    {
      name: "generate_image",
      arguments: {
        prompt: "one pixel",
        output_directory: outputDirectory,
        include_image: true,
      },
    },
    CallToolResultSchema,
  );
  const parsedResult = CallToolResultSchema.parse(result);

  assert.equal(parsedResult.isError, undefined);
  assert.equal(fakeClient.generatedPayloads[0]?.model, config.defaultModel);
  assert.equal(parsedResult.content[0]?.type, "image");
  assert.equal(
    parsedResult.content[0]?.type === "image" ? parsedResult.content[0].data : undefined,
    PNG_BASE64,
  );
  const structured = parsedResult.structuredContent as {
    filePath: string;
    model: string;
    costUsd: number;
  };
  assert.equal(structured.model, config.defaultModel);
  assert.equal(structured.costUsd, 0.014);
  assert.deepEqual(await readFile(structured.filePath), Buffer.from(PNG_BASE64, "base64"));
});

test("explicit model overrides the installed default", async (context) => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "image-mcp-test-"));
  const fakeClient = new FakeImageClient();
  const { client, server } = await createConnectedPair(fakeClient);
  context.after(async () => {
    await client.close();
    await server.close();
    await rm(outputDirectory, { recursive: true, force: true });
  });

  await client.callTool({
    name: "generate_image",
    arguments: {
      prompt: "one pixel",
      output_directory: outputDirectory,
      model: "openai/gpt-image-2",
    },
  });

  assert.equal(fakeClient.generatedPayloads[0]?.model, "openai/gpt-image-2");
  assert.equal(fakeClient.generatedPayloads[0]?.quality, "medium");
});

test("uses model-specific defaults and honors explicit quality", async (context) => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "image-mcp-test-"));
  const fakeClient = new FakeImageClient();
  const { client, server } = await createConnectedPair(fakeClient);
  context.after(async () => {
    await client.close();
    await server.close();
    await rm(outputDirectory, { recursive: true, force: true });
  });

  await client.callTool({
    name: "generate_image",
    arguments: {
      prompt: "one pixel",
      output_directory: outputDirectory,
      model: "google/gemini-3.1-flash-image",
    },
  });
  assert.equal(fakeClient.generatedPayloads[0]?.resolution, "1K");
  assert.equal(fakeClient.generatedPayloads[0]?.quality, undefined);

  await client.callTool({
    name: "generate_image",
    arguments: {
      prompt: "one pixel",
      output_directory: outputDirectory,
      quality: "high",
    },
  });
  assert.equal(fakeClient.generatedPayloads[1]?.quality, "high");
});

test("omits image content by default while keeping the saved result", async (context) => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "image-mcp-test-"));
  const fakeClient = new FakeImageClient();
  const { client, server } = await createConnectedPair(fakeClient);
  context.after(async () => {
    await client.close();
    await server.close();
    await rm(outputDirectory, { recursive: true, force: true });
  });

  const result = CallToolResultSchema.parse(
    await client.callTool({
      name: "generate_image",
      arguments: {
        prompt: "one pixel",
        output_directory: outputDirectory,
      },
    }),
  );

  assert.equal(result.isError, undefined);
  assert.deepEqual(result.content.map((item) => item.type), ["text"]);
  const structured = result.structuredContent as { filePath: string };
  assert.deepEqual(await readFile(structured.filePath), Buffer.from(PNG_BASE64, "base64"));
});

test("rejects unsupported parameters before generation", async (context) => {
  const fakeClient = new FakeImageClient({
    input_references: { type: "range", min: 0, max: 4 },
  });
  const { client, server } = await createConnectedPair(fakeClient);
  context.after(async () => {
    await client.close();
    await server.close();
  });

  const result = await client.callTool(
    {
      name: "generate_image",
      arguments: {
        prompt: "one pixel",
        output_directory: tmpdir(),
        resolution: "4K",
      },
    },
    CallToolResultSchema,
  );
  const parsedResult = CallToolResultSchema.parse(result);

  assert.equal(parsedResult.isError, true);
  assert.equal(fakeClient.generatedPayloads.length, 0);
  assert.match(
    parsedResult.content[0]?.type === "text" ? parsedResult.content[0].text : "",
    /No current endpoint supports/,
  );
});

test("rejects an invalid output directory before generation", async (context) => {
  const fakeClient = new FakeImageClient();
  const { client, server } = await createConnectedPair(fakeClient);
  context.after(async () => {
    await client.close();
    await server.close();
  });

  const result = CallToolResultSchema.parse(
    await client.callTool({
      name: "generate_image",
      arguments: {
        prompt: "one pixel",
        output_directory: path.join(tmpdir(), "directory-that-does-not-exist"),
      },
    }),
  );

  assert.equal(result.isError, true);
  assert.equal(fakeClient.generatedPayloads.length, 0);
});

test("converts a local reference image into an OpenRouter data URL", async (context) => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), "image-mcp-test-"));
  const referencePath = path.join(outputDirectory, "reference.png");
  await writeFile(referencePath, Buffer.from(PNG_BASE64, "base64"));
  const fakeClient = new FakeImageClient();
  const { client, server } = await createConnectedPair(fakeClient);
  context.after(async () => {
    await client.close();
    await server.close();
    await rm(outputDirectory, { recursive: true, force: true });
  });

  await client.callTool({
    name: "generate_image",
    arguments: {
      prompt: "edit the reference",
      output_directory: outputDirectory,
      reference_images: [referencePath],
    },
  });

  assert.match(
    fakeClient.generatedPayloads[0]?.input_references?.[0]?.image_url.url ?? "",
    /^data:image\/png;base64,/,
  );
});