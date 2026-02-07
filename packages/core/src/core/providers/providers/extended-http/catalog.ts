import type { ProviderOnboardingEnvField, ProviderOnboardingSpec } from "../../provider-module.js";

export type ExtendedHttpProviderProtocol = "openai-chat" | "anthropic-messages" | "bedrock-converse";

export type ExtendedHttpAuthHeader = "bearer" | "x-api-key" | "api-key";

interface ExtendedHttpProviderEndpoint {
  baseUrl?: string;
  baseUrlEnvVar?: string;
  endpointPath?: string;
  endpointPathEnvVar?: string;
  endpointEnvVar?: string;
  resolveBaseUrl?: (env: NodeJS.ProcessEnv) => string | undefined;
}

interface ExtendedHttpProviderAuth {
  envVars?: string[];
  header?: ExtendedHttpAuthHeader;
  optional?: boolean;
  oauthTokenHeader?: ExtendedHttpAuthHeader;
}

interface ExtendedHttpHeaderFromEnv {
  name: string;
  envVar: string;
}

export interface ExtendedHttpProviderSpec {
  id: string;
  displayName: string;
  protocol: ExtendedHttpProviderProtocol;
  endpoint: ExtendedHttpProviderEndpoint;
  auth?: ExtendedHttpProviderAuth;
  requiredEnv: ProviderOnboardingEnvField[];
  modelEnvVar: string;
  defaultModel?: string;
  stripProviderPrefix?: boolean;
  fixedHeaders?: Record<string, string>;
  headersFromEnv?: ExtendedHttpHeaderFromEnv[];
  maxTokensEnvVar?: string;
  defaultMaxTokens?: number;
}

const field = (
  key: string,
  description: string,
  options: { required?: boolean; secret?: boolean } = {}
): ProviderOnboardingEnvField => ({
  key,
  description,
  required: options.required,
  secret: options.secret
});

function resolveCloudflareGatewayBaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  const accountId = env.CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID?.trim();
  const gatewayId = env.CLOUDFLARE_AI_GATEWAY_GATEWAY_ID?.trim();
  if (!accountId || !gatewayId) {
    return undefined;
  }

  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/anthropic`;
}

export const extendedHttpProviderCatalog: ExtendedHttpProviderSpec[] = [
  {
    id: "amazon-bedrock",
    displayName: "Amazon Bedrock",
    protocol: "bedrock-converse",
    endpoint: {},
    requiredEnv: [field("AMAZON_BEDROCK_MODEL", "Default Bedrock model id", { required: true })],
    modelEnvVar: "AMAZON_BEDROCK_MODEL",
    stripProviderPrefix: true
  },
  {
    id: "anthropic",
    displayName: "Anthropic",
    protocol: "anthropic-messages",
    endpoint: {
      baseUrl: "https://api.anthropic.com",
      baseUrlEnvVar: "ANTHROPIC_BASE_URL",
      endpointPath: "/v1/messages",
      endpointPathEnvVar: "ANTHROPIC_ENDPOINT_PATH",
      endpointEnvVar: "ANTHROPIC_ENDPOINT"
    },
    auth: {
      envVars: ["ANTHROPIC_API_KEY", "ANTHROPIC_OAUTH_TOKEN"],
      header: "x-api-key",
      oauthTokenHeader: "bearer"
    },
    requiredEnv: [
      field("ANTHROPIC_API_KEY", "Anthropic API key (or set ANTHROPIC_OAUTH_TOKEN)", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "ANTHROPIC_MODEL",
    defaultModel: "claude-opus-4-5",
    stripProviderPrefix: true,
    fixedHeaders: {
      "anthropic-version": "2023-06-01"
    },
    headersFromEnv: [{ name: "anthropic-version", envVar: "ANTHROPIC_VERSION" }],
    maxTokensEnvVar: "ANTHROPIC_MAX_TOKENS",
    defaultMaxTokens: 4096
  },
  {
    id: "azure-openai-responses",
    displayName: "Azure OpenAI Responses",
    protocol: "openai-chat",
    endpoint: {
      endpointEnvVar: "AZURE_OPENAI_ENDPOINT"
    },
    auth: {
      envVars: ["AZURE_OPENAI_API_KEY"],
      header: "api-key"
    },
    requiredEnv: [
      field("AZURE_OPENAI_API_KEY", "Azure OpenAI API key", { required: true, secret: true }),
      field("AZURE_OPENAI_ENDPOINT", "Azure OpenAI endpoint (full chat completions URL)", {
        required: true
      }),
      field("AZURE_OPENAI_MODEL", "Azure OpenAI model/deployment id", { required: true })
    ],
    modelEnvVar: "AZURE_OPENAI_MODEL",
    stripProviderPrefix: true
  },
  {
    id: "cerebras",
    displayName: "Cerebras",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.cerebras.ai/v1",
      baseUrlEnvVar: "CEREBRAS_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "CEREBRAS_ENDPOINT_PATH",
      endpointEnvVar: "CEREBRAS_ENDPOINT"
    },
    auth: {
      envVars: ["CEREBRAS_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [field("CEREBRAS_API_KEY", "Cerebras API key", { required: true, secret: true })],
    modelEnvVar: "CEREBRAS_MODEL",
    stripProviderPrefix: true
  },
  {
    id: "chutes",
    displayName: "Chutes",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://llm.chutes.ai/v1",
      baseUrlEnvVar: "CHUTES_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "CHUTES_ENDPOINT_PATH",
      endpointEnvVar: "CHUTES_ENDPOINT"
    },
    auth: {
      envVars: ["CHUTES_API_KEY", "CHUTES_OAUTH_TOKEN"],
      header: "bearer",
      oauthTokenHeader: "bearer"
    },
    requiredEnv: [
      field("CHUTES_API_KEY", "Chutes API key (or set CHUTES_OAUTH_TOKEN)", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "CHUTES_MODEL",
    stripProviderPrefix: true
  },
  {
    id: "cloudflare-ai-gateway",
    displayName: "Cloudflare AI Gateway",
    protocol: "anthropic-messages",
    endpoint: {
      resolveBaseUrl: resolveCloudflareGatewayBaseUrl,
      endpointPath: "/v1/messages",
      endpointPathEnvVar: "CLOUDFLARE_AI_GATEWAY_ENDPOINT_PATH",
      endpointEnvVar: "CLOUDFLARE_AI_GATEWAY_ENDPOINT"
    },
    auth: {
      envVars: ["CLOUDFLARE_AI_GATEWAY_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [
      field("CLOUDFLARE_AI_GATEWAY_API_KEY", "Cloudflare AI Gateway API key", {
        required: true,
        secret: true
      }),
      field("CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID", "Cloudflare account id", { required: true }),
      field("CLOUDFLARE_AI_GATEWAY_GATEWAY_ID", "Cloudflare AI Gateway id", { required: true })
    ],
    modelEnvVar: "CLOUDFLARE_AI_GATEWAY_MODEL",
    defaultModel: "claude-sonnet-4-5",
    stripProviderPrefix: true,
    fixedHeaders: {
      "anthropic-version": "2023-06-01"
    },
    maxTokensEnvVar: "CLOUDFLARE_AI_GATEWAY_MAX_TOKENS",
    defaultMaxTokens: 4096
  },
  {
    id: "copilot-proxy",
    displayName: "Copilot Proxy",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "http://127.0.0.1:4141/v1",
      baseUrlEnvVar: "COPILOT_PROXY_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "COPILOT_PROXY_ENDPOINT_PATH",
      endpointEnvVar: "COPILOT_PROXY_ENDPOINT"
    },
    auth: {
      envVars: ["COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"],
      header: "bearer"
    },
    requiredEnv: [
      field("COPILOT_GITHUB_TOKEN", "GitHub token for Copilot proxy", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "COPILOT_PROXY_MODEL",
    stripProviderPrefix: true
  },
  {
    id: "github-copilot",
    displayName: "GitHub Copilot",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.githubcopilot.com",
      baseUrlEnvVar: "GITHUB_COPILOT_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "GITHUB_COPILOT_ENDPOINT_PATH",
      endpointEnvVar: "GITHUB_COPILOT_ENDPOINT"
    },
    auth: {
      envVars: ["COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"],
      header: "bearer"
    },
    requiredEnv: [
      field("COPILOT_GITHUB_TOKEN", "GitHub Copilot token", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "GITHUB_COPILOT_MODEL",
    stripProviderPrefix: true
  },
  {
    id: "google",
    displayName: "Google Gemini",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      baseUrlEnvVar: "GOOGLE_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "GOOGLE_ENDPOINT_PATH",
      endpointEnvVar: "GOOGLE_ENDPOINT"
    },
    auth: {
      envVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [field("GEMINI_API_KEY", "Gemini API key", { required: true, secret: true })],
    modelEnvVar: "GEMINI_MODEL",
    defaultModel: "gemini-3-pro-preview",
    stripProviderPrefix: true
  },
  {
    id: "google-antigravity",
    displayName: "Google Antigravity",
    protocol: "openai-chat",
    endpoint: {
      baseUrlEnvVar: "GOOGLE_ANTIGRAVITY_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "GOOGLE_ANTIGRAVITY_ENDPOINT_PATH",
      endpointEnvVar: "GOOGLE_ANTIGRAVITY_ENDPOINT"
    },
    auth: {
      envVars: ["GOOGLE_ANTIGRAVITY_TOKEN"],
      header: "bearer"
    },
    requiredEnv: [
      field("GOOGLE_ANTIGRAVITY_BASE_URL", "Google Antigravity base URL", { required: true }),
      field("GOOGLE_ANTIGRAVITY_TOKEN", "Google Antigravity OAuth token", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "GOOGLE_ANTIGRAVITY_MODEL",
    stripProviderPrefix: true
  },
  {
    id: "google-gemini-cli",
    displayName: "Google Gemini CLI OAuth",
    protocol: "openai-chat",
    endpoint: {
      baseUrlEnvVar: "GOOGLE_GEMINI_CLI_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "GOOGLE_GEMINI_CLI_ENDPOINT_PATH",
      endpointEnvVar: "GOOGLE_GEMINI_CLI_ENDPOINT"
    },
    auth: {
      envVars: ["GOOGLE_GEMINI_CLI_OAUTH_TOKEN"],
      header: "bearer"
    },
    requiredEnv: [
      field("GOOGLE_GEMINI_CLI_BASE_URL", "Google Gemini CLI-compatible base URL", {
        required: true
      }),
      field("GOOGLE_GEMINI_CLI_OAUTH_TOKEN", "Google Gemini CLI OAuth token", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "GOOGLE_GEMINI_CLI_MODEL",
    stripProviderPrefix: true
  },
  {
    id: "google-vertex",
    displayName: "Google Vertex",
    protocol: "openai-chat",
    endpoint: {
      baseUrlEnvVar: "GOOGLE_VERTEX_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "GOOGLE_VERTEX_ENDPOINT_PATH",
      endpointEnvVar: "GOOGLE_VERTEX_ENDPOINT"
    },
    auth: {
      envVars: ["GOOGLE_VERTEX_ACCESS_TOKEN"],
      header: "bearer"
    },
    requiredEnv: [
      field("GOOGLE_VERTEX_BASE_URL", "Google Vertex OpenAI-compatible base URL", {
        required: true
      }),
      field("GOOGLE_VERTEX_ACCESS_TOKEN", "Google Vertex access token", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "GOOGLE_VERTEX_MODEL",
    stripProviderPrefix: true
  },
  {
    id: "groq",
    displayName: "Groq",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.groq.com/openai/v1",
      baseUrlEnvVar: "GROQ_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "GROQ_ENDPOINT_PATH",
      endpointEnvVar: "GROQ_ENDPOINT"
    },
    auth: {
      envVars: ["GROQ_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [field("GROQ_API_KEY", "Groq API key", { required: true, secret: true })],
    modelEnvVar: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
    stripProviderPrefix: true
  },
  {
    id: "huggingface",
    displayName: "Hugging Face",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://router.huggingface.co/v1",
      baseUrlEnvVar: "HUGGINGFACE_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "HUGGINGFACE_ENDPOINT_PATH",
      endpointEnvVar: "HUGGINGFACE_ENDPOINT"
    },
    auth: {
      envVars: ["HF_TOKEN"],
      header: "bearer"
    },
    requiredEnv: [field("HF_TOKEN", "Hugging Face token", { required: true, secret: true })],
    modelEnvVar: "HUGGINGFACE_MODEL",
    stripProviderPrefix: true
  },
  {
    id: "kimi-coding",
    displayName: "Kimi Coding",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.moonshot.ai/v1",
      baseUrlEnvVar: "KIMI_CODING_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "KIMI_CODING_ENDPOINT_PATH",
      endpointEnvVar: "KIMI_CODING_ENDPOINT"
    },
    auth: {
      envVars: ["KIMI_API_KEY", "KIMICODE_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [
      field("KIMI_API_KEY", "Kimi Coding API key (or set KIMICODE_API_KEY)", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "KIMI_CODING_MODEL",
    defaultModel: "k2p5",
    stripProviderPrefix: true
  },
  {
    id: "minimax",
    displayName: "MiniMax",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.minimax.chat/v1",
      baseUrlEnvVar: "MINIMAX_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "MINIMAX_ENDPOINT_PATH",
      endpointEnvVar: "MINIMAX_ENDPOINT"
    },
    auth: {
      envVars: ["MINIMAX_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [field("MINIMAX_API_KEY", "MiniMax API key", { required: true, secret: true })],
    modelEnvVar: "MINIMAX_MODEL",
    defaultModel: "MiniMax-M2.1",
    stripProviderPrefix: true
  },
  {
    id: "minimax-cn",
    displayName: "MiniMax CN",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.minimax.chat/v1",
      baseUrlEnvVar: "MINIMAX_CN_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "MINIMAX_CN_ENDPOINT_PATH",
      endpointEnvVar: "MINIMAX_CN_ENDPOINT"
    },
    auth: {
      envVars: ["MINIMAX_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [field("MINIMAX_API_KEY", "MiniMax API key", { required: true, secret: true })],
    modelEnvVar: "MINIMAX_CN_MODEL",
    defaultModel: "MiniMax-M2.1-lightning",
    stripProviderPrefix: true
  },
  {
    id: "minimax-portal",
    displayName: "MiniMax Portal OAuth",
    protocol: "anthropic-messages",
    endpoint: {
      baseUrl: "https://api.minimax.io/anthropic",
      baseUrlEnvVar: "MINIMAX_PORTAL_BASE_URL",
      endpointPath: "/v1/messages",
      endpointPathEnvVar: "MINIMAX_PORTAL_ENDPOINT_PATH",
      endpointEnvVar: "MINIMAX_PORTAL_ENDPOINT"
    },
    auth: {
      envVars: ["MINIMAX_OAUTH_TOKEN", "MINIMAX_API_KEY"],
      header: "x-api-key",
      oauthTokenHeader: "bearer"
    },
    requiredEnv: [
      field("MINIMAX_OAUTH_TOKEN", "MiniMax OAuth token (or set MINIMAX_API_KEY)", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "MINIMAX_PORTAL_MODEL",
    defaultModel: "MiniMax-M2.1",
    stripProviderPrefix: true,
    fixedHeaders: {
      "anthropic-version": "2023-06-01"
    },
    maxTokensEnvVar: "MINIMAX_PORTAL_MAX_TOKENS",
    defaultMaxTokens: 4096
  },
  {
    id: "mistral",
    displayName: "Mistral",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.mistral.ai/v1",
      baseUrlEnvVar: "MISTRAL_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "MISTRAL_ENDPOINT_PATH",
      endpointEnvVar: "MISTRAL_ENDPOINT"
    },
    auth: {
      envVars: ["MISTRAL_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [field("MISTRAL_API_KEY", "Mistral API key", { required: true, secret: true })],
    modelEnvVar: "MISTRAL_MODEL",
    defaultModel: "mistral-large-latest",
    stripProviderPrefix: true
  },
  {
    id: "moonshot",
    displayName: "Moonshot",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.moonshot.ai/v1",
      baseUrlEnvVar: "MOONSHOT_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "MOONSHOT_ENDPOINT_PATH",
      endpointEnvVar: "MOONSHOT_ENDPOINT"
    },
    auth: {
      envVars: ["MOONSHOT_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [field("MOONSHOT_API_KEY", "Moonshot API key", { required: true, secret: true })],
    modelEnvVar: "MOONSHOT_MODEL",
    defaultModel: "kimi-k2.5",
    stripProviderPrefix: true
  },
  {
    id: "ollama",
    displayName: "Ollama",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "http://127.0.0.1:11434/v1",
      baseUrlEnvVar: "OLLAMA_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "OLLAMA_ENDPOINT_PATH",
      endpointEnvVar: "OLLAMA_ENDPOINT"
    },
    auth: {
      envVars: ["OLLAMA_API_KEY"],
      header: "bearer",
      optional: true
    },
    requiredEnv: [],
    modelEnvVar: "OLLAMA_MODEL",
    defaultModel: "llama3.3",
    stripProviderPrefix: true
  },
  {
    id: "openai-codex",
    displayName: "OpenAI Codex OAuth",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.openai.com/v1",
      baseUrlEnvVar: "OPENAI_CODEX_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "OPENAI_CODEX_ENDPOINT_PATH",
      endpointEnvVar: "OPENAI_CODEX_ENDPOINT"
    },
    auth: {
      envVars: ["OPENAI_CODEX_OAUTH_TOKEN", "OPENAI_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [
      field("OPENAI_CODEX_OAUTH_TOKEN", "OpenAI Codex OAuth token (or set OPENAI_API_KEY)", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "OPENAI_CODEX_MODEL",
    defaultModel: "gpt-5.3-codex",
    stripProviderPrefix: true
  },
  {
    id: "opencode-zen",
    displayName: "OpenCode Zen",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://opencode.ai/zen/v1",
      baseUrlEnvVar: "OPENCODE_ZEN_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "OPENCODE_ZEN_ENDPOINT_PATH",
      endpointEnvVar: "OPENCODE_ZEN_ENDPOINT"
    },
    auth: {
      envVars: ["OPENCODE_API_KEY", "OPENCODE_ZEN_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [
      field("OPENCODE_API_KEY", "OpenCode Zen API key (or set OPENCODE_ZEN_API_KEY)", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "OPENCODE_ZEN_MODEL",
    defaultModel: "claude-opus-4-6",
    stripProviderPrefix: true
  },
  {
    id: "qianfan",
    displayName: "Qianfan",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://qianfan.baidubce.com/v2",
      baseUrlEnvVar: "QIANFAN_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "QIANFAN_ENDPOINT_PATH",
      endpointEnvVar: "QIANFAN_ENDPOINT"
    },
    auth: {
      envVars: ["QIANFAN_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [field("QIANFAN_API_KEY", "Qianfan API key", { required: true, secret: true })],
    modelEnvVar: "QIANFAN_MODEL",
    defaultModel: "deepseek-v3.2",
    stripProviderPrefix: true
  },
  {
    id: "qwen-portal",
    displayName: "Qwen Portal OAuth",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://portal.qwen.ai/v1",
      baseUrlEnvVar: "QWEN_PORTAL_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "QWEN_PORTAL_ENDPOINT_PATH",
      endpointEnvVar: "QWEN_PORTAL_ENDPOINT"
    },
    auth: {
      envVars: ["QWEN_OAUTH_TOKEN", "QWEN_PORTAL_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [
      field("QWEN_OAUTH_TOKEN", "Qwen OAuth token (or set QWEN_PORTAL_API_KEY)", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "QWEN_PORTAL_MODEL",
    defaultModel: "coder-model",
    stripProviderPrefix: true
  },
  {
    id: "synthetic",
    displayName: "Synthetic",
    protocol: "anthropic-messages",
    endpoint: {
      baseUrl: "https://api.synthetic.new/anthropic",
      baseUrlEnvVar: "SYNTHETIC_BASE_URL",
      endpointPath: "/v1/messages",
      endpointPathEnvVar: "SYNTHETIC_ENDPOINT_PATH",
      endpointEnvVar: "SYNTHETIC_ENDPOINT"
    },
    auth: {
      envVars: ["SYNTHETIC_API_KEY"],
      header: "x-api-key"
    },
    requiredEnv: [field("SYNTHETIC_API_KEY", "Synthetic API key", { required: true, secret: true })],
    modelEnvVar: "SYNTHETIC_MODEL",
    defaultModel: "hf:MiniMaxAI/MiniMax-M2.1",
    stripProviderPrefix: true,
    fixedHeaders: {
      "anthropic-version": "2023-06-01"
    },
    maxTokensEnvVar: "SYNTHETIC_MAX_TOKENS",
    defaultMaxTokens: 4096
  },
  {
    id: "venice",
    displayName: "Venice",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.venice.ai/api/v1",
      baseUrlEnvVar: "VENICE_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "VENICE_ENDPOINT_PATH",
      endpointEnvVar: "VENICE_ENDPOINT"
    },
    auth: {
      envVars: ["VENICE_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [field("VENICE_API_KEY", "Venice API key", { required: true, secret: true })],
    modelEnvVar: "VENICE_MODEL",
    defaultModel: "llama-3.3-70b",
    stripProviderPrefix: true
  },
  {
    id: "vercel-ai-gateway",
    displayName: "Vercel AI Gateway",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://ai-gateway.vercel.sh/v1",
      baseUrlEnvVar: "VERCEL_AI_GATEWAY_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "VERCEL_AI_GATEWAY_ENDPOINT_PATH",
      endpointEnvVar: "VERCEL_AI_GATEWAY_ENDPOINT"
    },
    auth: {
      envVars: ["AI_GATEWAY_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [
      field("AI_GATEWAY_API_KEY", "Vercel AI Gateway API key", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "AI_GATEWAY_MODEL",
    defaultModel: "anthropic/claude-opus-4.6",
    stripProviderPrefix: true
  },
  {
    id: "xiaomi",
    displayName: "Xiaomi",
    protocol: "anthropic-messages",
    endpoint: {
      baseUrl: "https://api.xiaomimimo.com/anthropic",
      baseUrlEnvVar: "XIAOMI_BASE_URL",
      endpointPath: "/v1/messages",
      endpointPathEnvVar: "XIAOMI_ENDPOINT_PATH",
      endpointEnvVar: "XIAOMI_ENDPOINT"
    },
    auth: {
      envVars: ["XIAOMI_API_KEY"],
      header: "x-api-key"
    },
    requiredEnv: [field("XIAOMI_API_KEY", "Xiaomi API key", { required: true, secret: true })],
    modelEnvVar: "XIAOMI_MODEL",
    defaultModel: "mimo-v2-flash",
    stripProviderPrefix: true,
    fixedHeaders: {
      "anthropic-version": "2023-06-01"
    },
    maxTokensEnvVar: "XIAOMI_MAX_TOKENS",
    defaultMaxTokens: 4096
  },
  {
    id: "zai",
    displayName: "Z.AI",
    protocol: "openai-chat",
    endpoint: {
      baseUrl: "https://api.z.ai/v1",
      baseUrlEnvVar: "ZAI_BASE_URL",
      endpointPath: "/chat/completions",
      endpointPathEnvVar: "ZAI_ENDPOINT_PATH",
      endpointEnvVar: "ZAI_ENDPOINT"
    },
    auth: {
      envVars: ["ZAI_API_KEY", "Z_AI_API_KEY"],
      header: "bearer"
    },
    requiredEnv: [
      field("ZAI_API_KEY", "Z.AI API key (or set Z_AI_API_KEY)", {
        required: true,
        secret: true
      })
    ],
    modelEnvVar: "ZAI_MODEL",
    defaultModel: "glm-4.7",
    stripProviderPrefix: true
  }
];

const modelEnvByProviderId = new Map(
  extendedHttpProviderCatalog.map((spec) => [spec.id, spec.modelEnvVar])
);

export function resolveExtendedHttpProviderModelEnvVar(providerId: string): string | undefined {
  return modelEnvByProviderId.get(providerId.trim().toLowerCase());
}

export function resolveExtendedHttpProviderOnboarding(spec: ExtendedHttpProviderSpec): ProviderOnboardingSpec {
  const env: ProviderOnboardingEnvField[] = spec.requiredEnv.map((entry) => ({ ...entry }));

  const hasRequiredModelField = env.some(
    (fieldEntry) => fieldEntry.key === spec.modelEnvVar && Boolean(fieldEntry.required)
  );
  if (!spec.defaultModel && !hasRequiredModelField) {
    env.push(field(spec.modelEnvVar, `Default model for ${spec.displayName}`, { required: true }));
  }

  return {
    env,
    auth: {
      supported: false,
      description: "Configure required credentials directly in provider settings."
    }
  };
}
