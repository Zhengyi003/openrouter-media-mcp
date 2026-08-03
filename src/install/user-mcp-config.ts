/**
 * Builds and edits VS Code user-level MCP configuration for this server so
 * installation and removal can stay deterministic without duplicating inputs.
 *
 * The generated server entry uses the installed CLI name as the command so a
 * Homebrew or npm install both converge to the same configuration shape.
 */

const USER_SERVER_ID = "openrouterImage";
const USER_API_KEY_INPUT_ID = "openrouter-image-api-key";
const USER_MODEL_INPUT_ID = "openrouter-image-default-model";

const USER_MODEL_OPTIONS = [
  "openai/gpt-image-2",
  "google/gemini-3.1-flash-image",
] as const;

type McpInput = {
  id: string;
  type: string;
  description?: string;
  password?: boolean;
  options?: string[];
  default?: string;
};

type McpServer = {
  type: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  gallery?: string;
  version?: string;
};

export type McpConfigFile = {
  inputs?: McpInput[];
  servers?: Record<string, McpServer>;
  [key: string]: unknown;
};

export type UserMcpInstallConfig = {
  serverId: string;
  apiKeyInputId: string;
  modelInputId: string;
  modelOptions: readonly string[];
  defaultModel: string;
};

export const USER_MCP_INSTALL_CONFIG: UserMcpInstallConfig = {
  serverId: USER_SERVER_ID,
  apiKeyInputId: USER_API_KEY_INPUT_ID,
  modelInputId: USER_MODEL_INPUT_ID,
  modelOptions: USER_MODEL_OPTIONS,
  defaultModel: "openai/gpt-image-2",
};

function buildInputs(config: UserMcpInstallConfig): McpInput[] {
  return [
    {
      type: "promptString",
      id: config.apiKeyInputId,
      description: "OpenRouter API key",
      password: true,
    },
    {
      type: "pickString",
      id: config.modelInputId,
      description: "Default OpenRouter model for generate_image",
      options: [...config.modelOptions],
      default: config.defaultModel,
    },
  ];
}

function buildServer(config: UserMcpInstallConfig): McpServer {
  return {
    type: "stdio",
    command: "openrouter-image-mcp",
    env: {
      OPENROUTER_API_KEY: `\${input:${config.apiKeyInputId}}`,
      OPENROUTER_IMAGE_MODEL: `\${input:${config.modelInputId}}`,
    },
  };
}

export function mergeUserMcpConfig(
  current: McpConfigFile,
  config: UserMcpInstallConfig = USER_MCP_INSTALL_CONFIG,
): McpConfigFile {
  const existingInputs = (current.inputs ?? []).filter(
    (input) => input.id !== config.apiKeyInputId && input.id !== config.modelInputId,
  );
  const inputs = [...existingInputs, ...buildInputs(config)];

  return {
    ...current,
    inputs,
    servers: {
      ...(current.servers ?? {}),
      [config.serverId]: buildServer(config),
    },
  };
}

export function removeUserMcpConfig(
  current: McpConfigFile,
  config: UserMcpInstallConfig = USER_MCP_INSTALL_CONFIG,
): McpConfigFile {
  const nextServers = { ...(current.servers ?? {}) };
  delete nextServers[config.serverId];

  const nextInputs = (current.inputs ?? []).filter(
    (input) => input.id !== config.apiKeyInputId && input.id !== config.modelInputId,
  );

  const nextConfig: McpConfigFile = { ...current };

  if (nextInputs.length > 0) {
    nextConfig.inputs = nextInputs;
  } else {
    delete nextConfig.inputs;
  }

  if (Object.keys(nextServers).length > 0) {
    nextConfig.servers = nextServers;
  } else {
    delete nextConfig.servers;
  }

  return nextConfig;
}