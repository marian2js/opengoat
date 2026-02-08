import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError,
  UnsupportedProviderOptionError
} from "./errors.js";
import type {
  Provider,
  ProviderAuthOptions,
  ProviderCreateAgentOptions,
  ProviderDeleteAgentOptions,
  ProviderCapabilities,
  ProviderExecutionResult,
  ProviderInvokeOptions,
  ProviderKind
} from "./types.js";

export interface BaseProviderConfig {
  id: string;
  displayName: string;
  kind: ProviderKind;
  capabilities: ProviderCapabilities;
}

export abstract class BaseProvider implements Provider {
  public readonly id: string;
  public readonly displayName: string;
  public readonly kind: ProviderKind;
  public readonly capabilities: ProviderCapabilities;

  protected constructor(config: BaseProviderConfig) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.kind = config.kind;
    this.capabilities = config.capabilities;
  }

  protected validateInvokeOptions(options: ProviderInvokeOptions): void {
    if (!options.message.trim()) {
      throw new ProviderRuntimeError(this.id, "message cannot be empty");
    }

    if (options.agent && !this.capabilities.agent) {
      throw new UnsupportedProviderOptionError(this.id, "--agent");
    }

    if (options.model && !this.capabilities.model) {
      throw new UnsupportedProviderOptionError(this.id, "--model");
    }

    if (options.passthroughArgs && options.passthroughArgs.length > 0 && !this.capabilities.passthrough) {
      throw new UnsupportedProviderOptionError(this.id, "passthrough args");
    }
  }

  protected requireEnvValue(env: NodeJS.ProcessEnv, name: string): string {
    const value = env[name]?.trim();
    if (!value) {
      throw new ProviderAuthenticationError(this.id, `missing required environment variable ${name}`);
    }
    return value;
  }

  public abstract invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult>;

  public invokeAuth(_options: ProviderAuthOptions = {}): Promise<ProviderExecutionResult> {
    throw new UnsupportedProviderActionError(this.id, "auth");
  }

  public createAgent(_options: ProviderCreateAgentOptions): Promise<ProviderExecutionResult> {
    throw new UnsupportedProviderActionError(this.id, "create_agent");
  }

  public deleteAgent(_options: ProviderDeleteAgentOptions): Promise<ProviderExecutionResult> {
    throw new UnsupportedProviderActionError(this.id, "delete_agent");
  }
}
