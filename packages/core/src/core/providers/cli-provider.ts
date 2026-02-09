import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeCommand } from "./command-executor.js";
import { ProviderCommandNotFoundError, UnsupportedProviderActionError } from "./errors.js";
import { BaseProvider, type BaseProviderConfig } from "./base-provider.js";
import { imageExtensionForMediaType, renderImagePathContext, resolveProviderImageInputs } from "./image-input.js";
import type {
  ProviderAuthOptions,
  ProviderCreateAgentOptions,
  ProviderDeleteAgentOptions,
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

  protected buildCreateAgentInvocationArgs(
    _options: ProviderCreateAgentOptions,
    _command: string
  ): string[] {
    throw new UnsupportedProviderActionError(this.id, "create_agent");
  }

  protected buildDeleteAgentInvocationArgs(
    _options: ProviderDeleteAgentOptions,
    _command: string
  ): string[] {
    throw new UnsupportedProviderActionError(this.id, "delete_agent");
  }

  protected prepareExecutionEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    return env;
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

  public buildCreateAgentInvocation(
    options: ProviderCreateAgentOptions,
    env: NodeJS.ProcessEnv = process.env
  ): ProviderInvocation {
    const command = this.resolveCommand(env);
    const args = this.buildCreateAgentInvocationArgs(options, command);
    return { command, args };
  }

  public buildDeleteAgentInvocation(
    options: ProviderDeleteAgentOptions,
    env: NodeJS.ProcessEnv = process.env
  ): ProviderInvocation {
    const command = this.resolveCommand(env);
    const args = this.buildDeleteAgentInvocationArgs(options, command);
    return { command, args };
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    const env = this.prepareExecutionEnv(options.env ?? process.env);
    const prepared = await this.prepareImageInvocationOptions(options);
    const invocation = this.buildInvocation(prepared.options, env);

    try {
      return await executeCommand({
        command: invocation.command,
        args: invocation.args,
        cwd: options.cwd,
        env,
        abortSignal: options.abortSignal,
        onStdout: options.onStdout,
        onStderr: options.onStderr
      });
    } catch (error) {
      if (isSpawnPermissionOrMissing(error)) {
        throw new ProviderCommandNotFoundError(this.id, invocation.command);
      }

      throw error;
    } finally {
      await cleanupTempDirs(prepared.tempDirs);
    }
  }

  public override async invokeAuth(options: ProviderAuthOptions = {}): Promise<ProviderExecutionResult> {
    const env = this.prepareExecutionEnv(options.env ?? process.env);
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

  public override async createAgent(options: ProviderCreateAgentOptions): Promise<ProviderExecutionResult> {
    const env = this.prepareExecutionEnv(options.env ?? process.env);
    const invocation = this.buildCreateAgentInvocation(options, env);

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

  public override async deleteAgent(options: ProviderDeleteAgentOptions): Promise<ProviderExecutionResult> {
    const env = this.prepareExecutionEnv(options.env ?? process.env);
    const invocation = this.buildDeleteAgentInvocation(options, env);

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

  private async prepareImageInvocationOptions(options: ProviderInvokeOptions): Promise<{
    options: ProviderInvokeOptions;
    tempDirs: string[];
  }> {
    const resolvedImages = await resolveProviderImageInputs({
      providerId: this.id,
      images: options.images,
      cwd: options.cwd
    });
    if (resolvedImages.length === 0) {
      return { options, tempDirs: [] };
    }

    const imagePaths: string[] = [];
    const tempDirs: string[] = [];
    let tempDir: string | undefined;

    for (let index = 0; index < resolvedImages.length; index += 1) {
      const image = resolvedImages[index];
      if (image.sourcePath) {
        imagePaths.push(image.sourcePath);
        continue;
      }

      if (!tempDir) {
        tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-cli-image-"));
        tempDirs.push(tempDir);
      }

      const extension = imageExtensionForMediaType(image.mediaType);
      const baseName = sanitizeFileStem(image.name || `image-${index + 1}`);
      const targetPath = path.join(tempDir, `${baseName}.${extension}`);
      await writeFile(targetPath, Buffer.from(image.base64Data, "base64"));
      imagePaths.push(targetPath);
    }

    const imageContext = renderImagePathContext(imagePaths);
    if (!imageContext) {
      return { options, tempDirs };
    }

    return {
      options: {
        ...options,
        message: `${options.message.trim()}\n\n${imageContext}`
      },
      tempDirs
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

async function cleanupTempDirs(tempDirs: string[]): Promise<void> {
  await Promise.all(
    tempDirs.map((tempDir) =>
      rm(tempDir, {
        recursive: true,
        force: true
      }).catch(() => undefined)
    )
  );
}

function sanitizeFileStem(value: string): string {
  const compact = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return compact || "image";
}
