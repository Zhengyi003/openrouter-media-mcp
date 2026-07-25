/**
 * Defines the curated installation and per-call model choices.
 * Runtime capability checks remain authoritative because OpenRouter models and
 * endpoint parameters can change independently of this release.
 */

export const IMAGE_MODELS = [
  "openai/gpt-image-2",
  "google/gemini-3-pro-image",
  "google/gemini-2.5-flash-image",
  "x-ai/grok-imagine-image-quality",
  "google/gemini-3.1-flash-lite-image",
] as const;

export type ImageModel = (typeof IMAGE_MODELS)[number];

export function isImageModel(value: string): value is ImageModel {
  return (IMAGE_MODELS as readonly string[]).includes(value);
}