/**
 * Verifies OpenRouter HTTP path construction, authentication, and timeout
 * mapping without connecting to the external service.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OpenRouterClient } from "../src/openrouter/client.js";

test("preserves the model separator in endpoint discovery URLs", async () => {
  let requestedUrl = "";
  const fakeFetch: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer secret");
    return Response.json({ id: "vendor/model", endpoints: [] });
  };
  const client = new OpenRouterClient("secret", 1_000, fakeFetch);

  await client.getImageEndpoints("vendor/model", new AbortController().signal);

  assert.match(requestedUrl, /\/images\/models\/vendor\/model\/endpoints$/);
});

test("maps request timeouts to a concise OpenRouter error", async () => {
  const fakeFetch: typeof fetch = async (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(init.signal?.reason),
        { once: true },
      );
    });
  const client = new OpenRouterClient("secret", 10, fakeFetch);

  await assert.rejects(
    client.getImageEndpoints("vendor/model", new AbortController().signal),
    /did not respond within 10 ms/,
  );
});