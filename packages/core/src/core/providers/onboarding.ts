import { DEFAULT_AGENT_ID } from "../domain/agent-id.js";
import type { ProviderSummary } from "./types.js";

export interface ProviderOnboardingFamily {
  id: string;
  label: string;
  hint?: string;
  providerIds: string[];
}

const ONBOARDING_PROVIDER_ORDER = [
  "openai",
  "anthropic",
  "grok",
  "openrouter",
  "google",
  "gemini",
  "amazon-bedrock",
  "azure-openai-responses",
  "groq",
  "mistral",
  "moonshot",
  "ollama",
  "claude",
  "codex",
  "cursor",
  "opencode",
  "openclaw"
] as const;

const providerPriorityById = new Map<string, number>(
  ONBOARDING_PROVIDER_ORDER.map((id, index) => [id, index])
);

const ORGANIZED_PROVIDER_FAMILIES: ProviderOnboardingFamily[] = [
  { id: "openai", label: "OpenAI", providerIds: ["openai", "openai-codex", "azure-openai-responses"] },
  { id: "anthropic", label: "Anthropic", providerIds: ["anthropic"] },
  { id: "minimax", label: "MiniMax", providerIds: ["minimax", "minimax-cn", "minimax-portal"] },
  { id: "moonshot", label: "Moonshot AI (Kimi)", providerIds: ["moonshot", "kimi-coding"] },
  {
    id: "google",
    label: "Google",
    providerIds: ["google", "google-antigravity", "google-gemini-cli", "google-vertex"]
  },
  { id: "openrouter", label: "OpenRouter", providerIds: ["openrouter"] },
  { id: "qwen", label: "Qwen", hint: "OAuth", providerIds: ["qwen-portal"] },
  { id: "zai", label: "Z.AI (GLM)", providerIds: ["zai"] },
  { id: "copilot", label: "Copilot", providerIds: ["github-copilot", "copilot-proxy"] },
  { id: "vercel", label: "Vercel AI Gateway", providerIds: ["vercel-ai-gateway"] },
  { id: "opencode", label: "OpenCode Zen", providerIds: ["opencode-zen"] },
  { id: "xiaomi", label: "Xiaomi", providerIds: ["xiaomi"] },
  { id: "synthetic", label: "Synthetic", providerIds: ["synthetic"] },
  { id: "venice", label: "Venice AI", providerIds: ["venice"] },
  { id: "cloudflare", label: "Cloudflare AI Gateway", providerIds: ["cloudflare-ai-gateway"] },
  { id: "groq", label: "Groq", providerIds: ["groq"] },
  { id: "mistral", label: "Mistral", providerIds: ["mistral"] },
  { id: "qianfan", label: "Qianfan", providerIds: ["qianfan"] },
  { id: "bedrock", label: "Amazon Bedrock", providerIds: ["amazon-bedrock"] },
  { id: "cerebras", label: "Cerebras", providerIds: ["cerebras"] },
  { id: "chutes", label: "Chutes", providerIds: ["chutes"] },
  { id: "huggingface", label: "Hugging Face", providerIds: ["huggingface"] },
  { id: "ollama", label: "Ollama", providerIds: ["ollama"] },
  { id: "cli-tools", label: "Local CLI tools", providerIds: ["claude", "codex", "cursor", "gemini", "opencode", "openclaw"] }
];

const PROVIDER_SETUP_URLS: Record<string, string> = {
  openai: "https://platform.openai.com/api-keys",
  "openai-codex": "https://platform.openai.com",
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/app/apikey",
  "google-antigravity": "https://github.com/openclaw/google-antigravity-auth",
  "google-gemini-cli": "https://github.com/openclaw/google-gemini-cli-auth",
  grok: "https://console.x.ai",
  groq: "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/keys",
  moonshot: "https://platform.moonshot.ai",
  "kimi-coding": "https://platform.moonshot.ai",
  mistral: "https://console.mistral.ai/api-keys",
  cerebras: "https://cloud.cerebras.ai/platform",
  chutes: "https://chutes.ai/docs/sign-in-with-chutes/overview",
  huggingface: "https://huggingface.co/settings/tokens",
  minimax: "https://platform.minimax.io",
  "minimax-cn": "https://platform.minimax.io",
  "minimax-portal": "https://platform.minimax.io",
  "qwen-portal": "https://chat.qwen.ai",
  zai: "https://bigmodel.cn",
  qianfan: "https://cloud.baidu.com/product/wenxinworkshop",
  "vercel-ai-gateway": "https://vercel.com/dashboard/ai-gateway",
  "cloudflare-ai-gateway": "https://dash.cloudflare.com",
  "github-copilot": "https://github.com/features/copilot",
  "copilot-proxy": "https://github.com/openclaw/copilot-proxy",
  venice: "https://venice.ai",
  synthetic: "https://synthetic.new",
  xiaomi: "https://platform.xiaomi.com"
};

export function isDefaultOnboardingAgent(agentId: string): boolean {
  return agentId.trim().toLowerCase() === DEFAULT_AGENT_ID;
}

export function filterProvidersForOnboarding(agentId: string, providers: ProviderSummary[]): ProviderSummary[] {
  if (!isDefaultOnboardingAgent(agentId)) {
    return providers;
  }

  return providers.filter((provider) => provider.kind === "http");
}

export function sortProvidersForOnboarding(providers: ProviderSummary[]): ProviderSummary[] {
  return providers.slice().sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "http" ? -1 : 1;
    }

    const leftPriority = providerPriorityById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightPriority = providerPriorityById.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const byName = left.displayName.localeCompare(right.displayName);
    if (byName !== 0) {
      return byName;
    }

    return left.id.localeCompare(right.id);
  });
}

export function selectProvidersForOnboarding(agentId: string, providers: ProviderSummary[]): ProviderSummary[] {
  return sortProvidersForOnboarding(filterProvidersForOnboarding(agentId, providers));
}

export function buildProviderFamilies(providers: ProviderSummary[]): ProviderOnboardingFamily[] {
  const providerById = new Map(providers.map((provider) => [provider.id, provider] as const));
  const families: ProviderOnboardingFamily[] = [];
  const usedProviderIds = new Set<string>();

  for (const family of ORGANIZED_PROVIDER_FAMILIES) {
    const presentIds = family.providerIds.filter((id) => providerById.has(id));
    if (presentIds.length === 0) {
      continue;
    }
    presentIds.forEach((id) => usedProviderIds.add(id));
    families.push({
      id: family.id,
      label: family.label,
      ...(family.hint ? { hint: family.hint } : {}),
      providerIds: presentIds
    });
  }

  const leftovers = providers
    .filter((provider) => !usedProviderIds.has(provider.id))
    .sort((left, right) => {
      const byName = left.displayName.localeCompare(right.displayName);
      if (byName !== 0) {
        return byName;
      }
      return left.id.localeCompare(right.id);
    });
  for (const provider of leftovers) {
    families.push({
      id: `provider:${provider.id}`,
      label: provider.displayName,
      providerIds: [provider.id]
    });
  }

  return families;
}

export function resolveOnboardingProviderSetupUrl(providerId: string): string | undefined {
  return PROVIDER_SETUP_URLS[providerId];
}
