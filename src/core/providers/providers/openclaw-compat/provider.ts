import { executeCommand } from "../../command-executor.js";
import { BaseProvider } from "../../base-provider.js";
import {
  ProviderCommandNotFoundError,
  ProviderRuntimeError,
  UnsupportedProviderActionError
} from "../../errors.js";
import type {
  ProviderAuthOptions,
  ProviderExecutionResult,
  ProviderInvokeOptions
} from "../../types.js";
import type { OpenClawCompatProviderSpec } from "./catalog.js";
import { attachProviderSessionId } from "../../provider-session.js";

interface CommandExecutionOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

interface OpenClawCompatProviderDeps {
  execute?: (options: CommandExecutionOptions) => Promise<ProviderExecutionResult>;
}

interface OpenClawModelsListResponse {
  models?: Array<{
    key?: string;
    tags?: string[];
  }>;
}

const GLOBAL_MODEL_ENV_VAR = "OPENGOAT_OPENCLAW_MODEL";
const OPENCLAW_COMMAND_ENV_VAR = "OPENCLAW_CMD";
const modelDiscoveryCache = new Map<string, string | null>();

export class OpenClawCompatProvider extends BaseProvider {
  private readonly spec: OpenClawCompatProviderSpec;
  private readonly execute: (options: CommandExecutionOptions) => Promise<ProviderExecutionResult>;

  public constructor(spec: OpenClawCompatProviderSpec, deps: OpenClawCompatProviderDeps = {}) {
    super({
      id: spec.id,
      displayName: spec.displayName,
      kind: "cli",
      capabilities: {
        agent: true,
        model: true,
        auth: Boolean(spec.auth),
        passthrough: true
      }
    });
    this.spec = spec;
    this.execute = deps.execute ?? executeCommand;
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);
    const env = options.env ?? process.env;
    const command = this.resolveCommand(env);
    const model = await this.resolveModel(options, command, env);

    if (!model) {
      return {
        code: 1,
        stdout: "",
        stderr:
          `Missing model for provider "${this.spec.providerId}". ` +
          `Set ${this.spec.modelEnvVar}, ${GLOBAL_MODEL_ENV_VAR}, or pass --model.\n`
      };
    }

    const args = this.buildInvocationArgs(options, model);

    try {
      const result = await this.execute({
        command,
        args,
        cwd: options.cwd,
        env,
        onStdout: options.onStdout,
        onStderr: options.onStderr
      });
      return attachProviderSessionId(result, options.providerSessionId?.trim());
    } catch (error) {
      if (isSpawnPermissionOrMissing(error)) {
        throw new ProviderCommandNotFoundError(this.id, command);
      }
      throw error;
    }
  }

  public override async invokeAuth(options: ProviderAuthOptions = {}): Promise<ProviderExecutionResult> {
    if (!this.spec.auth) {
      throw new UnsupportedProviderActionError(this.id, "auth");
    }

    const env = options.env ?? process.env;
    const command = this.resolveCommand(env);
    const args = this.buildAuthArgs(options);

    try {
      return await this.execute({
        command,
        args,
        cwd: options.cwd,
        env,
        onStdout: options.onStdout,
        onStderr: options.onStderr
      });
    } catch (error) {
      if (isSpawnPermissionOrMissing(error)) {
        throw new ProviderCommandNotFoundError(this.id, command);
      }
      throw error;
    }
  }

  private resolveCommand(env: NodeJS.ProcessEnv): string {
    return env[OPENCLAW_COMMAND_ENV_VAR]?.trim() || "openclaw";
  }

  private buildInvocationArgs(options: ProviderInvokeOptions, model: string): string[] {
    const args = ["agent"];

    if (options.agent?.trim()) {
      args.push(options.agent.trim());
    }

    if (options.providerSessionId?.trim()) {
      args.push("--session-id", options.providerSessionId.trim());
    }

    args.push("--model", model);
    args.push(...(options.passthroughArgs ?? []));
    args.push("--message", options.message);

    return args;
  }

  private buildAuthArgs(options: ProviderAuthOptions): string[] {
    const passthrough = options.passthroughArgs ?? [];
    if (passthrough.length > 0) {
      return passthrough;
    }

    const auth = this.spec.auth;
    if (!auth) {
      throw new UnsupportedProviderActionError(this.id, "auth");
    }

    if (auth.type === "onboard-auth-choice") {
      return ["onboard", "--auth-choice", auth.authChoice];
    }

    if (auth.type === "models-auth-login") {
      return ["models", "auth", "login", "--provider", auth.providerId];
    }

    throw new ProviderRuntimeError(this.id, "unsupported OpenClaw auth strategy");
  }

  private async resolveModel(
    options: ProviderInvokeOptions,
    command: string,
    env: NodeJS.ProcessEnv
  ): Promise<string | null> {
    const explicit = options.model?.trim();
    if (explicit) {
      return explicit;
    }

    const modelEnvVars = [this.spec.modelEnvVar, ...this.spec.modelEnvAliases, GLOBAL_MODEL_ENV_VAR];
    for (const envVar of modelEnvVars) {
      const value = env[envVar]?.trim();
      if (value) {
        return value;
      }
    }

    const discovered = await this.discoverDefaultModel(command, env, options.cwd);
    if (discovered) {
      return discovered;
    }

    return this.spec.defaultModel ?? null;
  }

  private async discoverDefaultModel(
    command: string,
    env: NodeJS.ProcessEnv,
    cwd?: string
  ): Promise<string | null> {
    const cacheKey = [
      command,
      this.spec.providerId,
      env.OPENCLAW_STATE_DIR?.trim() || "",
      cwd?.trim() || ""
    ].join("::");

    if (modelDiscoveryCache.has(cacheKey)) {
      return modelDiscoveryCache.get(cacheKey) ?? null;
    }

    try {
      const result = await this.execute({
        command,
        args: ["models", "list", "--all", "--provider", this.spec.providerId, "--json"],
        cwd,
        env
      });
      if (result.code !== 0) {
        modelDiscoveryCache.set(cacheKey, null);
        return null;
      }

      const payload = JSON.parse(result.stdout) as OpenClawModelsListResponse;
      const models = payload.models ?? [];
      const preferred =
        models.find((entry) => entry.tags?.includes("default"))?.key ||
        models.find((entry) => typeof entry.key === "string")?.key ||
        null;

      const resolved = preferred?.trim() || null;
      modelDiscoveryCache.set(cacheKey, resolved);
      return resolved;
    } catch {
      modelDiscoveryCache.set(cacheKey, null);
      return null;
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
