/**
 * Describes the subset of OpenRouter's dedicated Image API used by this MCP.
 * Keeping provider payloads typed here isolates external schema changes from
 * MCP tool and file-system concerns.
 */

export type CapabilityDescriptor =
  | { type: "boolean" }
  | { type: "enum"; values: string[] }
  | { type: "range"; min: number; max: number };

export interface ImageEndpoint {
  provider_name: string;
  provider_slug: string;
  provider_tag: string | null;
  supported_parameters: Record<string, CapabilityDescriptor>;
  supports_streaming: boolean;
  pricing: Array<{
    billable: string;
    unit: string;
    cost_usd: number;
    variant?: string;
  }>;
}

export interface ImageEndpointsResponse {
  id: string;
  endpoints: ImageEndpoint[];
}

export interface GenerateImageRequest {
  model: string;
  prompt: string;
  resolution?: string;
  aspect_ratio?: string;
  quality?: "auto" | "low" | "medium" | "high";
  background?: "auto" | "transparent" | "opaque";
  output_format?: "png" | "jpeg" | "webp";
  seed?: number;
  input_references?: Array<{
    type: "image_url";
    image_url: { url: string };
  }>;
}

export interface GenerateImageResponse {
  created: number;
  data: Array<{ b64_json: string; media_type?: string }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
}