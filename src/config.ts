/**
 * Reads process-level configuration for the MCP server.
 * Tool handlers receive validated values from this boundary instead of reading
 * environment variables throughout the application.
 */

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-image";
const DEFAULT_TIMEOUT_MS = 300_000;

export interface ServerConfig {
  apiKey: string | undefined;
  defaultModel: string;
  diagnosticsEnabled: boolean;
  requestTimeoutMs: number;
}

function readPositiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return fallback;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

export function loadConfig(): ServerConfig {
  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultModel: process.env.OPENROUTER_IMAGE_MODEL ?? DEFAULT_MODEL,
    diagnosticsEnabled: process.env.MCP_DIAGNOSTICS === "1",
    requestTimeoutMs: readPositiveInteger(
      "OPENROUTER_REQUEST_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
    ),
  };
}