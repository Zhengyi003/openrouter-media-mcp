# OpenRouter Image MCP

A local TypeScript MCP server that generates one image through OpenRouter, saves it to a caller-selected directory, and returns the image to the MCP client for preview.

The server is designed for VS Code. It is distributed as a single CLI command, `openrouter-image-mcp`, that starts the MCP server over stdio and also provides a `setup` command that registers the server in your VS Code user configuration.

## Requirements

- Node.js 20 or newer
- An OpenRouter API key
- VS Code with MCP support

## Install

Every version is published as a GitHub Release whose asset is the single source of truth for installation. The recommended path is Homebrew; a manual download is available when Homebrew is not an option. Both end up with the same `openrouter-image-mcp` command, so the generated VS Code configuration is identical either way.

### Homebrew (recommended)

```bash
brew install <your-tap>/openrouter-image-mcp && openrouter-image-mcp setup
```

The formula downloads the compiled release asset from GitHub Releases and installs its runtime dependencies into a Homebrew-managed prefix.

### Manual download

1. Open the [releases page](https://github.com/Zhengyi003/openrouter-media-mcp/releases) and download `openrouter-image-mcp-<version>.tgz` for the version you want. Node.js 20 or newer is required.
2. Extract the archive and install the runtime dependencies:

   ```bash
   tar -xzf openrouter-image-mcp-<version>.tgz -C openrouter-image-mcp
   cd openrouter-image-mcp
   npm install --omit=dev
   ```

3. Run the CLI from the extracted directory:

   ```bash
   node dist/index.js setup
   ```

   VS Code launches the MCP server itself by running the same entry point without arguments (`node dist/index.js`), so the setup step above is all you need to do by hand.

A future npm channel is planned but not yet available; this page will be updated when it is.

### What setup does

`openrouter-image-mcp setup` reads the VS Code user-level `mcp.json`, adds the `openrouterImage` server entry and its two input variables, and writes the file back atomically without touching unrelated servers.

- `OPENROUTER_API_KEY`: stored by VS Code as a password input.
- `OPENROUTER_IMAGE_MODEL`: the default model used when a call omits `model`.

To remove the server later, run `openrouter-image-mcp setup --uninstall`.

### Automatic configuration boundary

`setup` targets the default local user profile of the Stable desktop build of VS Code. If you use multiple VS Code profiles, a Remote environment, VS Code Insiders, or another VS Code distribution, open the correct configuration manually with **MCP: Open User Configuration** or **MCP: Open Remote User Configuration** and add this server:

```json
{
  "servers": {
    "openrouterImage": {
      "type": "stdio",
      "command": "openrouter-image-mcp",
      "env": {
        "OPENROUTER_API_KEY": "${input:openrouter-image-api-key}",
        "OPENROUTER_IMAGE_MODEL": "${input:openrouter-image-default-model}"
      }
    }
  },
  "inputs": [
    {
      "id": "openrouter-image-api-key",
      "type": "promptString",
      "description": "OpenRouter API key",
      "password": true
    },
    {
      "id": "openrouter-image-default-model",
      "type": "pickString",
      "description": "Default OpenRouter model for generate_image",
      "options": [
        "openai/gpt-image-2",
        "google/gemini-3.1-flash-image"
      ],
      "default": "openai/gpt-image-2"
    }
  ]
}
```

After installing, restart VS Code or run **MCP: List Servers** to start the server and confirm the tool list. If the tool list is stale, run **MCP: Reset Cached Tools**.

## Tool

`generate_image` generates exactly one image. Generation usually takes about one minute and can take longer; the tool waits for the final result.

Required arguments:

- `prompt`: image instructions.
- `output_directory`: an existing writable directory, absolute or relative to the MCP server working directory.

Optional arguments:

- `model`: overrides the installed default for this call.
- `reference_images`: local PNG, JPEG, or WebP paths, up to the model endpoint limit and 20 MiB each.
- `include_image`: defaults to `false`; set it to `true` when the image should be included in MCP content for immediate model inspection. The image is always saved and metadata is always returned.
- `resolution`, `aspect_ratio`, `quality`, `background`, `output_format`, and `seed`: accepted only when a current endpoint supports them. The default model is `openai/gpt-image-2` with `quality: "medium"`; `google/gemini-3.1-flash-image` uses `resolution: "1K"` by default. Explicit parameters override these defaults. For GPT Image 2, use `quality` and omit `resolution`; for Gemini 3.1 Flash Image, use `resolution` and omit `quality`.

The result contains a text summary and structured metadata with the absolute file path, MIME type, byte count, model, elapsed time, reference count, and cost when OpenRouter reports it. When `include_image` is `true`, it also contains an MCP image content block.

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

These steps are for working on the repository itself, not for installing the server.

```bash
npm install
npm run build
npm run typecheck
npm test
```

All automated tests use in-memory transports and fake HTTP clients; they do not call OpenRouter or incur charges.

### Releases

Releases are produced by the GitHub Actions workflow `.github/workflows/release.yml`. Pushing a version tag (for example `v0.1.0`) runs typecheck and the test suite, verifies the tag matches `package.json`'s version, builds `dist/`, packs a compiled release asset (`openrouter-image-mcp-<version>.tgz`), and creates a GitHub Release with the asset and its SHA-256 checksum. That release asset is the single source of truth for both the Homebrew formula and manual downloads.
