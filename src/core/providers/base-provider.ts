import { executeCommand } from "./command-executor.js";
import {
  ProviderAuthenticationError,
  ProviderCommandNotFoundError,
  ProviderRuntimeError,
  UnsupportedProviderActionError,
  UnsupportedProviderOptionError
} from "./errors.js";
import type {
  Provider,
  ProviderAuthOptions,
  ProviderCapabilities,
  ProviderExecutionResult,
  ProviderInvocation,
  ProviderInvokeOptions,
  ProviderKind
} from "./types.js";

interface BaseProviderConfig {
  id: string;
  displayName: string;
  kind: ProviderKind;
  capabilities: ProviderCapabilities;
}

interface BaseCliProviderConfig extends BaseProviderConfig {
  command: string;
  commandEnvVar: string;
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
}

export abstract class BaseCliProvider extends BaseProvider {
  private readonly command: string;
  private readonly commandEnvVar: string;

  protected constructor(config: BaseCliProviderConfig) {
    super(config);
    this.command = config.command;
    this.commandEnvVar = config.commandEnvVar;
  }

  protected resolveCommand(env: NodeJS.ProcessEnv): string {
    const override = env[this.commandEnvVar]?.trim();
    return override || this.command;
  }

  protected abstract buildInvocationArgs(options: ProviderInvokeOptions, command: string): string[];

  protected buildAuthInvocationArgs(options: ProviderAuthOptions, _command: string): string[] {
    if (!this.capabilities.auth) {
      throw new UnsupportedProviderActionError(this.id, "auth");
    }

    return options.passthroughArgs ?? [];
  }

  public buildInvocation(options: ProviderInvokeOptions, env: NodeJS.ProcessEnv = process.env): ProviderInvocation {
    this.validateInvokeOptions(options);
    const command = this.resolveCommand(env);
    const args = this.buildInvocationArgs(options, command);

    return { command, args };
  }

  public buildAuthInvocation(
    options: ProviderAuthOptions = {},
    env: NodeJS.ProcessEnv = process.env
  ): ProviderInvocation {
    const command = this.resolveCommand(env);
    const args = this.buildAuthInvocationArgs(options, command);

    return { command, args };
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    const env = options.env ?? process.env;
    const invocation = this.buildInvocation(options, env);

    try {
      return await executeCommand({
        command: invocation.command,
        args: invocation.args,
        cwd: options.cwd,
        env,
        onStdout: options.onStdout,
        onStderr: options.onStderr
      });
    } catch (error) {
      if (isSpawnPermissionOrMissing(error)) {
        throw new ProviderCommandNotFoundError(this.id, invocation.command);
      }

      throw error;
    }
  }

  public override async invokeAuth(options: ProviderAuthOptions = {}): Promise<ProviderExecutionResult> {
    const env = options.env ?? process.env;
    const invocation = this.buildAuthInvocation(options, env);

    try {
      return await executeCommand({
        command: invocation.command,
        args: invocation.args,
        cwd: options.cwd,
        env,
        onStdout: options.onStdout,
        onStderr: options.onStderr
      });
    } catch (error) {
      if (isSpawnPermissionOrMissing(error)) {
        throw new ProviderCommandNotFoundError(this.id, invocation.command);
      }

      throw error;
    }
  }
}

function isSpawnPermissionOrMissing(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (((error as NodeJS.ErrnoException).code ?? "") === "ENOENT" ||
      ((error as NodeJS.ErrnoException).code ?? "") === "EACCES")
  );
}
