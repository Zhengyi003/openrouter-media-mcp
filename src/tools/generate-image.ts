/**
 * Defines the public generate_image contract and coordinates capability checks,
 * reference loading, OpenRouter generation, progress heartbeats, and local save.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ServerConfig } from "../config.js";
import {
  referenceFileToDataUrl,
  saveGeneratedImage,
  validateOutputDirectory,
} from "../files/image-files.js";
import {
  getImageModelDefaults,
  IMAGE_MODELS,
  isImageModel,
  type ImageModel,
} from "../models/catalog.js";
import { OpenRouterClient } from "../openrouter/client.js";
import type {
  CapabilityDescriptor,
  GenerateImageRequest,
  GenerateImageResponse,
  ImageEndpoint,
  ImageEndpointsResponse,
} from "../openrouter/types.js";

const HEARTBEAT_MS = 10_000;

const inputShape = {
  prompt: z.string().trim().min(1).max(20_000),
  output_directory: z.string().trim().min(1),
  model: z.enum(IMAGE_MODELS).optional(),
  reference_images: z.array(z.string().trim().min(1)).max(16).optional(),
  resolution: z.enum(["512", "1K", "2K", "4K"]).optional(),
  aspect_ratio: z.string().trim().min(1).max(16).optional(),
  quality: z.enum(["auto", "low", "medium", "high"]).optional(),
  background: z.enum(["auto", "transparent", "opaque"]).optional(),
  output_format: z.enum(["png", "jpeg", "webp"]).optional(),
  seed: z.number().int().nonnegative().optional(),
  include_image: z.boolean().default(false),
};

type GenerateArguments = {
  [Key in keyof typeof inputShape]: z.infer<(typeof inputShape)[Key]>;
};

export interface ImageApiClient {
  getImageEndpoints(
    model: string,
    signal: AbortSignal,
  ): Promise<ImageEndpointsResponse>;
  generateImage(
    payload: GenerateImageRequest,
    signal: AbortSignal,
  ): Promise<GenerateImageResponse>;
}

function supportsValue(
  descriptor: CapabilityDescriptor | undefined,
  value: string | number,
): boolean {
  if (descriptor === undefined) return false;
  if (descriptor.type === "boolean") return true;
  if (descriptor.type === "enum") return descriptor.values.includes(String(value));
  return typeof value === "number" && value >= descriptor.min && value <= descriptor.max;
}

function selectEndpoint(
  endpoints: ImageEndpoint[],
  arguments_: GenerateArguments,
): ImageEndpoint {
  const requested = [
    ["resolution", arguments_.resolution],
    ["aspect_ratio", arguments_.aspect_ratio],
    ["quality", arguments_.quality],
    ["background", arguments_.background],
    ["output_format", arguments_.output_format],
    ["seed", arguments_.seed],
  ] as const;
  const referenceCount = arguments_.reference_images?.length ?? 0;

  const endpoint = endpoints.find((candidate) => {
    const parameters = candidate.supported_parameters;
    const supportsRequested = requested.every(
      ([name, value]) => value === undefined || supportsValue(parameters[name], value),
    );
    return (
      supportsRequested &&
      (referenceCount === 0 ||
        supportsValue(parameters.input_references, referenceCount))
    );
  });

  if (endpoint === undefined) {
    throw new Error("No current endpoint supports the requested image parameters.");
  }
  return endpoint;
}

function buildPayload(
  model: string,
  arguments_: GenerateArguments,
  referenceUrls: string[],
): GenerateImageRequest {
  return {
    model,
    prompt: arguments_.prompt,
    ...(arguments_.resolution && { resolution: arguments_.resolution }),
    ...(arguments_.aspect_ratio && { aspect_ratio: arguments_.aspect_ratio }),
    ...(arguments_.quality && { quality: arguments_.quality }),
    ...(arguments_.background && { background: arguments_.background }),
    ...(arguments_.output_format && { output_format: arguments_.output_format }),
    ...(arguments_.seed !== undefined && { seed: arguments_.seed }),
    ...(referenceUrls.length > 0 && {
      input_references: referenceUrls.map((url) => ({
        type: "image_url" as const,
        image_url: { url },
      })),
    }),
  };
}

function applyModelDefaults(
  model: ImageModel,
  arguments_: GenerateArguments,
): GenerateArguments {
  const defaults = getImageModelDefaults(model);
  return {
    ...arguments_,
    ...(arguments_.quality === undefined && defaults.quality !== undefined && {
      quality: defaults.quality,
    }),
    ...(arguments_.resolution === undefined && defaults.resolution !== undefined && {
      resolution: defaults.resolution,
    }),
  };
}

export function registerGenerateImage(
  server: McpServer,
  config: ServerConfig,
  createClient: (apiKey: string) => ImageApiClient = (apiKey) =>
    new OpenRouterClient(apiKey, config.requestTimeoutMs),
): void {
  server.registerTool(
    "generate_image",
    {
      title: "Generate image with OpenRouter",
      description:
        "Generate one image with OpenRouter and save it to a required local directory. " +
        "Generation usually takes about one minute and may take longer; this call waits " +
        "for the final result. Omit model to use the installed default, or set model when " +
        "the user requests a different supported model. The image is saved and metadata is " +
        "returned by default; set include_image to true when the model should inspect the " +
        "image in the current conversation context. For openai/gpt-image-2, use quality " +
        "and do not provide resolution. For google/gemini-3.1-flash-image, use resolution " +
        "and do not provide quality.",
      inputSchema: inputShape,
      outputSchema: {
        filePath: z.string(),
        mimeType: z.string(),
        bytes: z.number().int().positive(),
        model: z.string(),
        elapsedMs: z.number().int().nonnegative(),
        referenceCount: z.number().int().nonnegative(),
        costUsd: z.number().nonnegative().optional(),
      },
    },
    async (arguments_, extra) => {
      if (config.apiKey === undefined || config.apiKey.length === 0) {
        return {
          content: [{ type: "text", text: "OPENROUTER_API_KEY is not configured." }],
          isError: true,
        };
      }

      const model = arguments_.model ?? config.defaultModel;
      if (!isImageModel(model)) {
        return {
          content: [{ type: "text", text: `Unsupported configured model: ${model}` }],
          isError: true,
        };
      }

      const effectiveArguments = applyModelDefaults(model, arguments_);

      const startedAt = Date.now();
      const client = createClient(config.apiKey);
      const heartbeat = setInterval(() => {
        if (extra._meta?.progressToken === undefined) return;
        const elapsedSeconds = Math.round((Date.now() - startedAt) / 1_000);
        void extra
          .sendNotification({
            method: "notifications/progress",
            params: {
              progressToken: extra._meta.progressToken,
              progress: elapsedSeconds,
              message: `Image generation is still running: ${elapsedSeconds} seconds elapsed.`,
            },
          })
          .catch(() => undefined);
      }, HEARTBEAT_MS);

      try {
        const endpointResponse = await client.getImageEndpoints(model, extra.signal);
        selectEndpoint(endpointResponse.endpoints, effectiveArguments);
        await validateOutputDirectory(effectiveArguments.output_directory);
        const referenceUrls = await Promise.all(
          (effectiveArguments.reference_images ?? []).map(referenceFileToDataUrl),
        );
        const response = await client.generateImage(
          buildPayload(model, effectiveArguments, referenceUrls),
          extra.signal,
        );
        const image = response.data[0];
        if (image === undefined || image.b64_json.length === 0) {
          throw new Error("OpenRouter returned no image.");
        }
        const saved = await saveGeneratedImage(
          effectiveArguments.output_directory,
          image.b64_json,
          image.media_type,
        );
        const elapsedMs = Date.now() - startedAt;
        const structuredContent = {
          ...saved,
          model,
          elapsedMs,
          referenceCount: referenceUrls.length,
          ...(response.usage?.cost !== undefined && {
            costUsd: response.usage.cost,
          }),
        };
        const costText =
          response.usage?.cost === undefined
            ? "not reported"
            : `$${response.usage.cost.toFixed(6)} USD`;

        const content: Array<
          | { type: "image"; data: string; mimeType: string }
          | { type: "text"; text: string }
        > = [];
        if (effectiveArguments.include_image) {
          content.push({ type: "image", data: image.b64_json, mimeType: saved.mimeType });
        }
        content.push({
          type: "text",
          text: [
            `Image saved to ${saved.filePath}`,
            `Model: ${model}`,
            `Elapsed: ${(elapsedMs / 1_000).toFixed(1)} seconds`,
            `Cost: ${costText}`,
            `References: ${referenceUrls.length}`,
          ].join("\n"),
        });

        return {
          content,
          structuredContent,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Image generation failed.";
        return { content: [{ type: "text", text: message }], isError: true };
      } finally {
        clearInterval(heartbeat);
      }
    },
  );
}