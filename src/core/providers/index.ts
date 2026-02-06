import type { ProviderSummary } from "./types.js";
import { ClaudeProvider } from "./builtins/claude.provider.js";
import { CodexProvider } from "./builtins/codex.provider.js";
import { CursorProvider } from "./builtins/cursor.provider.js";
import { OpenAIProvider } from "./builtins/openai.provider.js";
import { OpenClawProvider } from "./builtins/openclaw.provider.js";
import { OpenRouterProvider } from "./builtins/openrouter.provider.js";
import { ProviderRegistry, type ProviderFactory } from "./registry.js";

export const DEFAULT_PROVIDER_ID = "codex";

export function createDefaultProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registerBuiltinProviders(registry);
  return registry;
}

export function registerBuiltinProviders(registry: ProviderRegistry): void {
  registry.register("codex", () => new CodexProvider());
  registry.register("claude", () => new ClaudeProvider());
  registry.register("cursor", () => new CursorProvider());
  registry.register("openclaw", () => new OpenClawProvider());
  registry.register("openai", () => new OpenAIProvider());
  registry.register("openrouter", () => new OpenRouterProvider());
}

export function listProviderSummaries(registry: ProviderRegistry): ProviderSummary[] {
  return registry.listProviders().map((provider) => ({
    id: provider.id,
    displayName: provider.displayName,
    kind: provider.kind,
    capabilities: provider.capabilities
  }));
}

export { ProviderRegistry, type ProviderFactory } from "./registry.js";
export { BaseProvider, BaseCliProvider } from "./base-provider.js";
export { CodexProvider } from "./builtins/codex.provider.js";
export { ClaudeProvider } from "./builtins/claude.provider.js";
export { CursorProvider } from "./builtins/cursor.provider.js";
export { OpenClawProvider } from "./builtins/openclaw.provider.js";
export { OpenAIProvider } from "./builtins/openai.provider.js";
export { OpenRouterProvider } from "./builtins/openrouter.provider.js";
export type {
  Provider,
  ProviderAuthOptions,
  ProviderCapabilities,
  ProviderExecutionResult,
  ProviderInvokeOptions,
  ProviderKind,
  ProviderSummary,
  AgentProviderBinding
} from "./types.js";
export {
  AgentConfigNotFoundError,
  OpenGoatProviderError,
  ProviderAuthenticationError,
  ProviderCommandNotFoundError,
  ProviderNotFoundError,
  ProviderRuntimeError,
  UnsupportedProviderActionError,
  UnsupportedProviderOptionError
} from "./errors.js";
