/**
 * Provides a development-only probe for measuring how an MCP client handles
 * long-running calls, progress notifications, and cancellation.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const PROGRESS_INTERVAL_MS = 10_000;

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (): void => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    const handleAbort = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", handleAbort);
      reject(signal.reason ?? new Error("The diagnostic call was cancelled."));
    };

    if (signal.aborted) {
      handleAbort();
      return;
    }

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

export function registerLongCallDiagnostic(server: McpServer): void {
  server.registerTool(
    "diagnose_long_call",
    {
      title: "Diagnose long MCP call",
      description:
        "Development-only delay probe. It waits for the requested duration, " +
        "reports elapsed time when the client supports progress, and can be cancelled.",
      inputSchema: {
        seconds: z.number().int().min(1).max(180),
      },
      outputSchema: {
        elapsedSeconds: z.number().nonnegative(),
        completed: z.boolean(),
      },
    },
    async ({ seconds }, extra) => {
      const startedAt = Date.now();
      const durationMs = seconds * 1_000;

      try {
        while (Date.now() - startedAt < durationMs) {
          const elapsedMs = Date.now() - startedAt;
          const remainingMs = durationMs - elapsedMs;
          await wait(Math.min(PROGRESS_INTERVAL_MS, remainingMs), extra.signal);

          if (extra._meta?.progressToken !== undefined) {
            const elapsedSeconds = Math.min(
              seconds,
              Math.round((Date.now() - startedAt) / 1_000),
            );
            await extra.sendNotification({
              method: "notifications/progress",
              params: {
                progressToken: extra._meta.progressToken,
                progress: elapsedSeconds,
                message: `Still waiting: ${elapsedSeconds} seconds elapsed.`,
              },
            });
          }
        }
      } catch {
        return {
          content: [{ type: "text", text: "Long-call diagnostic cancelled." }],
          structuredContent: {
            elapsedSeconds: Math.round((Date.now() - startedAt) / 1_000),
            completed: false,
          },
          isError: true,
        };
      }

      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1_000);
      return {
        content: [
          {
            type: "text",
            text: `Long-call diagnostic completed after ${elapsedSeconds} seconds.`,
          },
        ],
        structuredContent: { elapsedSeconds, completed: true },
      };
    },
  );
}