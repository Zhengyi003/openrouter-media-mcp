/**
 * Owns authenticated, cancellable HTTP communication with OpenRouter's Image
 * API and maps remote failures to concise errors without exposing credentials
 * or base64 payloads.
 */

import type {
  GenerateImageRequest,
  GenerateImageResponse,
  ImageEndpointsResponse,
} from "./types.js";

const API_BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export class OpenRouterClient {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async getImageEndpoints(
    model: string,
    signal: AbortSignal,
  ): Promise<ImageEndpointsResponse> {
    const encodedModel = model.split("/").map(encodeURIComponent).join("/");
    return this.request<ImageEndpointsResponse>(
      `/images/models/${encodedModel}/endpoints`,
      { method: "GET" },
      signal,
    );
  }

  async generateImage(
    payload: GenerateImageRequest,
    signal: AbortSignal,
  ): Promise<GenerateImageResponse> {
    return this.request<GenerateImageResponse>(
      "/images",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      signal,
    );
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    signal: AbortSignal,
  ): Promise<T> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

    let response: Response;
    try {
      response = await this.fetchImplementation(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...init.headers,
        },
        signal: combinedSignal,
      });
    } catch (error) {
      if (signal.aborted) {
        throw new OpenRouterError("Image generation was cancelled.");
      }
      if (timeoutSignal.aborted) {
        throw new OpenRouterError(
          `OpenRouter did not respond within ${this.timeoutMs} ms.`,
        );
      }
      throw new OpenRouterError(
        `Unable to reach OpenRouter: ${error instanceof Error ? error.message : "network error"}`,
      );
    }

    if (!response.ok) {
      let remoteMessage = "";
      try {
        const body = (await response.json()) as {
          error?: { message?: string } | string;
        };
        remoteMessage =
          typeof body.error === "string"
            ? body.error
            : (body.error?.message ?? "");
      } catch {
        remoteMessage = "";
      }

      const suffix = remoteMessage ? `: ${remoteMessage.slice(0, 500)}` : "";
      throw new OpenRouterError(
        `OpenRouter request failed with HTTP ${response.status}${suffix}`,
        response.status,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new OpenRouterError("OpenRouter returned invalid JSON.");
    }
  }
}