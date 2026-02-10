import { loadProviderModules } from "./loader.js";
import { ProviderRegistry, type ProviderFactory } from "./registry.js";

export async function createDefaultProviderRegistry(): Promise<ProviderRegistry> {
  const registry = new ProviderRegistry();
  await loadProviderModules(registry);
  return registry;
}

export { ProviderRegistry, type ProviderFactory } from "./registry.js";
export { BaseProvider } from "./base-provider.js";
export { BaseCliProvider, type BaseCliProviderConfig } from "./cli-provider.js";
export { ProviderService } from "./application/provider.service.js";
export type {
  AgentRuntimeProfile,
  OpenClawGatewayConfig,
  ProviderStoredConfig
} from "./application/provider.service.js";
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
  ProviderInvocationLifecycleEvent,
  ProviderInvocationLifecycleHooks,
  ProviderInvokeOptions,
  ProviderInvokeRuntimeContext,
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
