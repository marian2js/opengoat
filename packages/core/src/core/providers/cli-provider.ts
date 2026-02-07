import { executeCommand } from "./command-executor.js";
import { ProviderCommandNotFoundError, UnsupportedProviderActionError } from "./errors.js";
import { BaseProvider, type BaseProviderConfig } from "./base-provider.js";
import type {
  ProviderAuthOptions,
  ProviderExecutionResult,
  ProviderInvocation,
  ProviderInvokeOptions
} from "./types.js";

export interface BaseCliProviderConfig extends BaseProviderConfig {
  command: string;
  commandEnvVar: string;
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
    const args = this.buildInvocationArgs(this.mergeSystemPrompt(options), command);

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

  private mergeSystemPrompt(options: ProviderInvokeOptions): ProviderInvokeOptions {
    const systemPrompt = options.systemPrompt?.trim();
    if (!systemPrompt) {
      return options;
    }

    return {
      ...options,
      message: `${systemPrompt}\n\n# User Message\n${options.message}`
    };
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
