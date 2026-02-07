import type { ProviderOnboardingEnvField, ProviderOnboardingSpec } from "../../provider-module.js";

type OpenClawCompatAuthStrategy =
  | {
      type: "onboard-auth-choice";
      authChoice: string;
    }
  | {
      type: "models-auth-login";
      providerId: string;
    };

interface OpenClawCompatCatalogEntry {
  providerId: string;
  displayName: string;
  defaultModel?: string;
  modelEnvAliases?: string[];
  env?: ProviderOnboardingEnvField[];
  auth?: OpenClawCompatAuthStrategy;
}

export interface OpenClawCompatProviderSpec {
  id: string;
  providerId: string;
  displayName: string;
  defaultModel?: string;
  modelEnvVar: string;
  modelEnvAliases: string[];
  env: ProviderOnboardingEnvField[];
  auth?: OpenClawCompatAuthStrategy;
}

const authChoice = (choice: string): OpenClawCompatAuthStrategy => ({
  type: "onboard-auth-choice",
  authChoice: choice
});

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

const catalogEntries: OpenClawCompatCatalogEntry[] = [
  {
    providerId: "amazon-bedrock",
    displayName: "Amazon Bedrock (OpenClaw Compat)",
    env: [
      field("AWS_PROFILE", "AWS named profile for Bedrock"),
      field("AWS_REGION", "AWS region override for Bedrock"),
      field("AWS_ACCESS_KEY_ID", "AWS access key id", { secret: true }),
      field("AWS_SECRET_ACCESS_KEY", "AWS secret access key", { secret: true }),
      field("AWS_BEARER_TOKEN_BEDROCK", "AWS Bedrock bearer token", { secret: true })
    ]
  },
  {
    providerId: "anthropic",
    displayName: "Anthropic (OpenClaw Compat)",
    defaultModel: "anthropic/claude-opus-4-5",
    modelEnvAliases: ["ANTHROPIC_MODEL"],
    env: [
      field("ANTHROPIC_API_KEY", "Anthropic API key", { secret: true }),
      field("ANTHROPIC_OAUTH_TOKEN", "Anthropic OAuth token", { secret: true })
    ],
    auth: authChoice("setup-token")
  },
  {
    providerId: "azure-openai-responses",
    displayName: "Azure OpenAI Responses (OpenClaw Compat)",
    env: [
      field("AZURE_OPENAI_API_KEY", "Azure OpenAI API key", { secret: true }),
      field("AZURE_OPENAI_ENDPOINT", "Azure OpenAI endpoint"),
      field("AZURE_OPENAI_MODEL", "Azure OpenAI model id")
    ]
  },
  {
    providerId: "cerebras",
    displayName: "Cerebras (OpenClaw Compat)",
    env: [field("CEREBRAS_API_KEY", "Cerebras API key", { secret: true })]
  },
  {
    providerId: "chutes",
    displayName: "Chutes (OpenClaw Compat)",
    env: [
      field("CHUTES_API_KEY", "Chutes API key", { secret: true }),
      field("CHUTES_OAUTH_TOKEN", "Chutes OAuth token", { secret: true })
    ],
    auth: authChoice("chutes")
  },
  {
    providerId: "cloudflare-ai-gateway",
    displayName: "Cloudflare AI Gateway (OpenClaw Compat)",
    defaultModel: "cloudflare-ai-gateway/anthropic/claude-opus-4.6",
    env: [
      field("CLOUDFLARE_AI_GATEWAY_API_KEY", "Cloudflare AI Gateway API key", {
        secret: true
      }),
      field("CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID", "Cloudflare account id"),
      field("CLOUDFLARE_AI_GATEWAY_GATEWAY_ID", "Cloudflare AI Gateway id")
    ],
    auth: authChoice("cloudflare-ai-gateway-api-key")
  },
  {
    providerId: "copilot-proxy",
    displayName: "Copilot Proxy (OpenClaw Compat)",
    env: [
      field("COPILOT_GITHUB_TOKEN", "GitHub token for Copilot proxy", {
        secret: true
      })
    ],
    auth: authChoice("copilot-proxy")
  },
  {
    providerId: "github-copilot",
    displayName: "GitHub Copilot (OpenClaw Compat)",
    env: [
      field("COPILOT_GITHUB_TOKEN", "GitHub Copilot token", { secret: true }),
      field("GH_TOKEN", "GitHub token fallback", { secret: true }),
      field("GITHUB_TOKEN", "GitHub token fallback", { secret: true })
    ],
    auth: authChoice("github-copilot")
  },
  {
    providerId: "google",
    displayName: "Google Gemini (OpenClaw Compat)",
    defaultModel: "google/gemini-3-pro-preview",
    modelEnvAliases: ["GEMINI_MODEL"],
    env: [field("GEMINI_API_KEY", "Gemini API key", { secret: true })],
    auth: authChoice("gemini-api-key")
  },
  {
    providerId: "google-antigravity",
    displayName: "Google Antigravity (OpenClaw Compat)",
    auth: authChoice("google-antigravity")
  },
  {
    providerId: "google-gemini-cli",
    displayName: "Google Gemini CLI OAuth (OpenClaw Compat)",
    auth: authChoice("google-gemini-cli")
  },
  {
    providerId: "google-vertex",
    displayName: "Google Vertex (OpenClaw Compat)",
    env: [field("GOOGLE_APPLICATION_CREDENTIALS", "Path to GCP service account credentials json")]
  },
  {
    providerId: "groq",
    displayName: "Groq (OpenClaw Compat)",
    env: [field("GROQ_API_KEY", "Groq API key", { secret: true })]
  },
  {
    providerId: "huggingface",
    displayName: "Hugging Face (OpenClaw Compat)",
    env: [field("HF_TOKEN", "Hugging Face token", { secret: true })]
  },
  {
    providerId: "kimi-coding",
    displayName: "Kimi Coding (OpenClaw Compat)",
    defaultModel: "kimi-coding/k2p5",
    env: [
      field("KIMI_API_KEY", "Kimi API key", { secret: true }),
      field("KIMICODE_API_KEY", "Kimi API key alias", { secret: true })
    ],
    auth: authChoice("kimi-code-api-key")
  },
  {
    providerId: "minimax",
    displayName: "MiniMax (OpenClaw Compat)",
    defaultModel: "minimax/MiniMax-M2.1",
    env: [field("MINIMAX_API_KEY", "MiniMax API key", { secret: true })],
    auth: authChoice("minimax-api")
  },
  {
    providerId: "minimax-cn",
    displayName: "MiniMax CN (OpenClaw Compat)",
    defaultModel: "minimax-cn/MiniMax-M2.1",
    env: [field("MINIMAX_API_KEY", "MiniMax API key", { secret: true })],
    auth: authChoice("minimax-api-lightning")
  },
  {
    providerId: "minimax-portal",
    displayName: "MiniMax Portal OAuth (OpenClaw Compat)",
    defaultModel: "minimax-portal/MiniMax-M2.1",
    env: [
      field("MINIMAX_OAUTH_TOKEN", "MiniMax OAuth token", { secret: true }),
      field("MINIMAX_API_KEY", "MiniMax API key fallback", { secret: true })
    ],
    auth: authChoice("minimax-portal")
  },
  {
    providerId: "mistral",
    displayName: "Mistral (OpenClaw Compat)",
    env: [field("MISTRAL_API_KEY", "Mistral API key", { secret: true })]
  },
  {
    providerId: "moonshot",
    displayName: "Moonshot (OpenClaw Compat)",
    defaultModel: "moonshot/kimi-k2.5",
    env: [field("MOONSHOT_API_KEY", "Moonshot API key", { secret: true })],
    auth: authChoice("moonshot-api-key")
  },
  {
    providerId: "ollama",
    displayName: "Ollama (OpenClaw Compat)",
    defaultModel: "ollama/llama3.3",
    env: [
      field("OLLAMA_API_KEY", "Optional Ollama auth token", { secret: true }),
      field("OLLAMA_BASE_URL", "Optional Ollama base URL override")
    ]
  },
  {
    providerId: "openai",
    displayName: "OpenAI (OpenClaw Compat)",
    defaultModel: "openai/gpt-5.1-codex",
    modelEnvAliases: ["OPENAI_MODEL"],
    env: [
      field("OPENAI_API_KEY", "OpenAI API key", { secret: true }),
      field("OPENAI_BASE_URL", "Optional OpenAI-compatible base URL")
    ],
    auth: authChoice("openai-api-key")
  },
  {
    providerId: "openai-codex",
    displayName: "OpenAI Codex OAuth (OpenClaw Compat)",
    defaultModel: "openai-codex/gpt-5.3-codex",
    auth: authChoice("openai-codex")
  },
  {
    providerId: "opencode",
    displayName: "OpenCode Zen (OpenClaw Compat)",
    defaultModel: "opencode/claude-opus-4-6",
    modelEnvAliases: ["OPENCODE_MODEL"],
    env: [
      field("OPENCODE_API_KEY", "OpenCode API key", { secret: true }),
      field("OPENCODE_ZEN_API_KEY", "OpenCode Zen API key", { secret: true })
    ],
    auth: authChoice("opencode-zen")
  },
  {
    providerId: "openrouter",
    displayName: "OpenRouter (OpenClaw Compat)",
    defaultModel: "openrouter/anthropic/claude-sonnet-4-5",
    modelEnvAliases: ["OPENROUTER_MODEL"],
    env: [field("OPENROUTER_API_KEY", "OpenRouter API key", { secret: true })],
    auth: authChoice("openrouter-api-key")
  },
  {
    providerId: "qwen-portal",
    displayName: "Qwen Portal OAuth (OpenClaw Compat)",
    env: [
      field("QWEN_OAUTH_TOKEN", "Qwen OAuth token", { secret: true }),
      field("QWEN_PORTAL_API_KEY", "Qwen portal API key", { secret: true })
    ],
    auth: authChoice("qwen-portal")
  },
  {
    providerId: "synthetic",
    displayName: "Synthetic (OpenClaw Compat)",
    defaultModel: "synthetic/hf:MiniMaxAI/MiniMax-M2.1",
    env: [field("SYNTHETIC_API_KEY", "Synthetic API key", { secret: true })],
    auth: authChoice("synthetic-api-key")
  },
  {
    providerId: "venice",
    displayName: "Venice (OpenClaw Compat)",
    defaultModel: "venice/llama-3.3-70b",
    env: [field("VENICE_API_KEY", "Venice API key", { secret: true })],
    auth: authChoice("venice-api-key")
  },
  {
    providerId: "vercel-ai-gateway",
    displayName: "Vercel AI Gateway (OpenClaw Compat)",
    defaultModel: "vercel-ai-gateway/anthropic/claude-opus-4.6",
    env: [field("AI_GATEWAY_API_KEY", "Vercel AI Gateway API key", { secret: true })],
    auth: authChoice("ai-gateway-api-key")
  },
  {
    providerId: "xai",
    displayName: "xAI (OpenClaw Compat)",
    defaultModel: "xai/grok-4",
    modelEnvAliases: ["GROK_MODEL"],
    env: [field("XAI_API_KEY", "xAI API key", { secret: true })],
    auth: authChoice("xai-api-key")
  },
  {
    providerId: "xiaomi",
    displayName: "Xiaomi (OpenClaw Compat)",
    defaultModel: "xiaomi/mimo-v2-flash",
    env: [field("XIAOMI_API_KEY", "Xiaomi API key", { secret: true })],
    auth: authChoice("xiaomi-api-key")
  },
  {
    providerId: "zai",
    displayName: "Z.AI (OpenClaw Compat)",
    defaultModel: "zai/glm-4.7",
    env: [
      field("ZAI_API_KEY", "Z.AI API key", { secret: true }),
      field("Z_AI_API_KEY", "Z.AI API key alias", { secret: true })
    ],
    auth: authChoice("zai-api-key")
  }
];

export const openClawCompatProviderCatalog: OpenClawCompatProviderSpec[] = catalogEntries.map((entry) => ({
  id: resolveOpenClawCompatProviderId(entry.providerId),
  providerId: entry.providerId,
  displayName: entry.displayName,
  defaultModel: entry.defaultModel,
  modelEnvVar: resolveOpenClawCompatModelEnvVar(entry.providerId),
  modelEnvAliases: entry.modelEnvAliases ?? [],
  env: entry.env ?? [],
  auth: entry.auth
}));

export function resolveOpenClawCompatProviderId(providerId: string): string {
  return `openclaw-${providerId.trim().toLowerCase()}`;
}

export function resolveOpenClawCompatModelEnvVar(providerId: string): string {
  const normalized = providerId
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `OPENGOAT_OPENCLAW_${normalized}_MODEL`;
}

export function resolveOpenClawCompatOnboarding(spec: OpenClawCompatProviderSpec): ProviderOnboardingSpec {
  return {
    env: [
      field("OPENCLAW_CMD", "Optional openclaw binary path override"),
      field("OPENCLAW_STATE_DIR", "Optional OpenClaw state dir override"),
      field(spec.modelEnvVar, "Optional default model for this provider"),
      ...spec.env
    ],
    auth: spec.auth
      ? {
          supported: true,
          description:
            spec.auth.type === "onboard-auth-choice"
              ? `Runs \`openclaw onboard --auth-choice ${spec.auth.authChoice}\`.`
              : `Runs \`openclaw models auth login --provider ${spec.auth.providerId}\`.`
        }
      : {
          supported: false,
          description: "This provider relies on environment/config credentials."
        }
  };
}
