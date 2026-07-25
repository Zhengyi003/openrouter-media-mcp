/**
 * Converts local reference images into OpenRouter data URLs and saves generated
 * base64 images atomically without overwriting existing workspace assets.
 */

import { randomBytes } from "node:crypto";
import { access, readFile, rename, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function detectMimeType(data: Buffer): string | undefined {
  if (data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return "image/png";
  }
  if (data.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) {
    return "image/jpeg";
  }
  if (
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

export async function referenceFileToDataUrl(filePath: string): Promise<string> {
  const absolutePath = path.resolve(filePath);
  const fileStats = await stat(absolutePath);
  if (!fileStats.isFile()) {
    throw new Error(`Reference image is not a file: ${absolutePath}`);
  }
  if (fileStats.size > MAX_REFERENCE_BYTES) {
    throw new Error(`Reference image exceeds 20 MiB: ${absolutePath}`);
  }

  const data = await readFile(absolutePath);
  const mimeType = detectMimeType(data);
  if (mimeType === undefined) {
    throw new Error(`Reference image must be PNG, JPEG, or WebP: ${absolutePath}`);
  }
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

export interface SavedImage {
  filePath: string;
  mimeType: string;
  bytes: number;
}

export async function validateOutputDirectory(
  outputDirectory: string,
): Promise<string> {
  const absoluteDirectory = path.resolve(outputDirectory);
  const directoryStats = await stat(absoluteDirectory);
  if (!directoryStats.isDirectory()) {
    throw new Error(`Output path is not a directory: ${absoluteDirectory}`);
  }
  await access(absoluteDirectory, constants.W_OK);
  return absoluteDirectory;
}

export async function saveGeneratedImage(
  outputDirectory: string,
  base64Data: string,
  declaredMimeType?: string,
): Promise<SavedImage> {
  const absoluteDirectory = await validateOutputDirectory(outputDirectory);

  const data = Buffer.from(base64Data, "base64");
  if (data.length === 0) {
    throw new Error("OpenRouter returned an empty image.");
  }
  const detectedMimeType = detectMimeType(data);
  if (
    declaredMimeType !== undefined &&
    detectedMimeType !== undefined &&
    declaredMimeType !== detectedMimeType
  ) {
    throw new Error("Generated image MIME type does not match its file content.");
  }
  const mimeType =
    declaredMimeType !== undefined && MIME_EXTENSIONS[declaredMimeType] !== undefined
      ? declaredMimeType
      : detectedMimeType;
  if (mimeType === undefined || MIME_EXTENSIONS[mimeType] === undefined) {
    throw new Error("Generated image is not a supported PNG, JPEG, or WebP file.");
  }

  const timestamp = new Date().toISOString().replaceAll(/[-:.TZ]/g, "");
  const suffix = randomBytes(4).toString("hex");
  const fileName = `openrouter-${timestamp}-${suffix}.${MIME_EXTENSIONS[mimeType]}`;
  const finalPath = path.join(absoluteDirectory, fileName);
  const temporaryPath = `${finalPath}.tmp`;

  await writeFile(temporaryPath, data, { flag: "wx" });
  try {
    await rename(temporaryPath, finalPath);
  } catch (error) {
    await import("node:fs/promises").then(({ rm }) =>
      rm(temporaryPath, { force: true }),
    );
    throw error;
  }

  return { filePath: finalPath, mimeType, bytes: data.length };
}