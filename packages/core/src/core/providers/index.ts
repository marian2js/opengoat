import type { ProviderSummary } from "./types.js";
import { loadProviderModules } from "./loader.js";
import { ProviderRegistry, type ProviderFactory } from "./registry.js";

export const DEFAULT_PROVIDER_ID = "codex";

export async function createDefaultProviderRegistry(): Promise<ProviderRegistry> {
  const registry = new ProviderRegistry();
  await loadProviderModules(registry);
  return registry;
}

export async function registerBuiltinProviders(registry: ProviderRegistry): Promise<void> {
  await loadProviderModules(registry);
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
export { BaseProvider } from "./base-provider.js";
export { BaseCliProvider, type BaseCliProviderConfig } from "./cli-provider.js";
export { ProviderService } from "./application/provider.service.js";
export type { AgentRuntimeProfile, ProviderStoredConfig } from "./application/provider.service.js";
export {
  buildProviderFamilies,
  filterProvidersForOnboarding,
  isDefaultOnboardingAgent,
  resolveOnboardingProviderSetupUrl,
  selectProvidersForOnboarding,
  sortProvidersForOnboarding
} from "./onboarding.js";
export type { ProviderOnboardingFamily } from "./onboarding.js";
export { loadProviderModules } from "./loader.js";
export type { ProviderModule } from "./provider-module.js";
export type { ProviderOnboardingEnvField, ProviderOnboardingSpec } from "./provider-module.js";
export type {
  Provider,
  ProviderAuthOptions,
  ProviderCreateAgentOptions,
  ProviderDeleteAgentOptions,
  ProviderCapabilities,
  ProviderExecutionResult,
  ProviderInvokeOptions,
  ProviderRunStatusEvent,
  ProviderKind,
  ProviderSummary,
  AgentProviderBinding
} from "./types.js";
export {
  AgentConfigNotFoundError,
  InvalidAgentConfigError,
  InvalidProviderConfigError,
  OpenGoatProviderError,
  ProviderAuthenticationError,
  ProviderCommandNotFoundError,
  ProviderNotFoundError,
  ProviderRuntimeError,
  UnsupportedProviderActionError,
  UnsupportedProviderOptionError
} from "./errors.js";
