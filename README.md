# OpenRouter Image MCP

A local TypeScript MCP server that generates one image through OpenRouter, saves it to a caller-selected directory, and returns the image to the MCP client for preview.

## Requirements

- Node.js 20 or newer
- An OpenRouter API key
- VS Code with MCP support

## Setup

```bash
npm install
npm run build
```

The workspace configuration in `.vscode/mcp.json` asks for two values when the server starts:

- `OPENROUTER_API_KEY`: stored by VS Code as a password input.
- `OPENROUTER_IMAGE_MODEL`: the default model used when a call omits `model`.

The curated model choices span premium to budget options. OpenRouter capabilities and prices can change, so the server validates the selected model endpoint at call time. A tool call can override the installed default by passing `model` when the user requests another supported model.

After building, run **MCP: List Servers** and restart `openrouterImage`. If the tool list is stale, run **MCP: Reset Cached Tools**.

## Tool

`generate_image` generates exactly one image. Generation usually takes about one minute and can take longer; the tool waits for the final result.

Required arguments:

- `prompt`: image instructions.
- `output_directory`: an existing writable directory, absolute or relative to the MCP server working directory.

Optional arguments:

- `model`: overrides the installed default for this call.
- `reference_images`: local PNG, JPEG, or WebP paths, up to the model endpoint limit and 20 MiB each.
- `resolution`, `aspect_ratio`, `quality`, `background`, `output_format`, and `seed`: accepted only when a current endpoint supports them.

The result contains an MCP image content block, a text summary, and structured metadata with the absolute file path, MIME type, byte count, model, elapsed time, reference count, and cost when OpenRouter reports it.

The output directory is validated before the paid generation request. Generated files use collision-resistant names and are written through a temporary file before atomic rename.

## Long Calls

The server sends elapsed-time progress notifications every ten seconds when the client supplies a progress token. These are client UI signals, not intermediate Agent tool results. The Agent resumes reasoning when the final tool result arrives. Cancellation is forwarded to the OpenRouter request.

Set `MCP_DIAGNOSTICS=1` only during development to expose `diagnose_long_call`. Normal installations should leave it unset or set to `0` so `generate_image` is the only tool.

## Security

- The API key is read only from the environment.
- Protocol messages use stdout; operational errors use stderr.
- API keys, reference data URLs, and generated base64 data are never logged.
- If VS Code MCP sandboxing is enabled, allow writes to the intended output directories and network access to `openrouter.ai`.

## Development

```bash
npm run typecheck
npm test
npm pack --dry-run
```

All automated tests use in-memory transports and fake HTTP clients; they do not call OpenRouter or incur charges.
