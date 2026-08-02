---
applyTo: "**/*"
---

# OpenRouter Image MCP

- Use the stable TypeScript SDK documentation at https://github.com/modelcontextprotocol/typescript-sdk and https://modelcontextprotocol.io/llms-full.txt when changing protocol code.
- Keep the production tool surface limited to `generate_image`; diagnostics must require `MCP_DIAGNOSTICS=1`.
- Write MCP protocol output only to stdout. Write operational diagnostics to stderr and never log API keys or base64 image data.
- Every source file starts with a documentation comment that explains its responsibility in the architecture.