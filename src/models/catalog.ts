/**
 * Defines the curated installation and per-call model choices.
 * Runtime capability checks remain authoritative because OpenRouter models and
 * endpoint parameters can change independently of this release.
 */

export const IMAGE_MODELS = [
  "openai/gpt-image-2",
  "google/gemini-3.1-flash-image",
] as const;

export type ImageModel = (typeof IMAGE_MODELS)[number];

export type ImageModelDefaults = {
  quality?: "auto" | "low" | "medium" | "high";
  resolution?: "512" | "1K" | "2K" | "4K";
};

const IMAGE_MODEL_DEFAULTS: Record<ImageModel, ImageModelDefaults> = {
  "openai/gpt-image-2": { quality: "medium" },
  "google/gemini-3.1-flash-image": { resolution: "1K" },
};

export function getImageModelDefaults(model: ImageModel): ImageModelDefaults {
  return IMAGE_MODEL_DEFAULTS[model];
}

export function isImageModel(value: string): value is ImageModel {
  return (IMAGE_MODELS as readonly string[]).includes(value);
}