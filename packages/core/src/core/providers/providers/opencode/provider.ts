import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeCommand } from "../../command-executor.js";
import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type {
  ProviderAuthOptions,
  ProviderCreateAgentOptions,
  ProviderExecutionResult,
  ProviderInvokeOptions
} from "../../types.js";

export class OpenCodeProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "opencode",
      displayName: "OpenCode",
      kind: "cli",
      command: "opencode",
      commandEnvVar: "OPENCODE_CMD",
      capabilities: {
        agent: false,
        model: true,
        auth: true,
        passthrough: true,
        agentCreate: true
      }
    });
  }

  protected buildInvocationArgs(options: ProviderInvokeOptions): string[] {
    const args = ["run"];

    if (options.providerSessionId?.trim()) {
      args.push("--session", options.providerSessionId.trim());
    }

    if (options.model) {
      args.push("--model", options.model);
    }

    args.push(...(options.passthroughArgs ?? []));
    args.push(options.message);

    return args;
  }

  protected override buildAuthInvocationArgs(options: ProviderAuthOptions): string[] {
    return ["auth", "login", ...(options.passthroughArgs ?? [])];
  }

  public override async createAgent(
    options: ProviderCreateAgentOptions
  ): Promise<ProviderExecutionResult> {
    const env = options.env ?? process.env;
    const agentFilePath = resolveOpenCodeAgentFilePath(options.agentId, env);

    try {
      await mkdir(path.dirname(agentFilePath), { recursive: true });
      const definition = renderOpenCodeAgentDefinition(options.displayName);
      await writeFile(agentFilePath, definition, { encoding: "utf-8", flag: "wx" });
      return {
        code: 0,
        stdout: `Created OpenCode agent '${options.agentId}' at ${agentFilePath}\n`,
        stderr: ""
      };
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        return {
          code: 0,
          stdout: `OpenCode agent '${options.agentId}' already exists at ${agentFilePath}\n`,
          stderr: ""
        };
      }

      return {
        code: 1,
        stdout: "",
        stderr: `Failed to create OpenCode agent '${options.agentId}': ${formatErrorMessage(error)}\n`
      };
    }
  }

  public override buildInvocation(
    options: ProviderInvokeOptions,
    env: NodeJS.ProcessEnv = process.env
  ) {
    const defaultModel = env.OPENCODE_MODEL?.trim();
    return super.buildInvocation(
      {
        ...options,
        model: options.model?.trim() || defaultModel || undefined
      },
      env
    );
  }

  public override async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    const env = options.env ?? process.env;
    const requestedSessionId = options.providerSessionId?.trim();
    const beforeSnapshot = requestedSessionId ? [] : await this.readRecentSessionIds(env, options.cwd);
    const result = await super.invoke(options);
    if (requestedSessionId) {
      return attachProviderSessionId(result, requestedSessionId);
    }

    const afterSnapshot = await this.readRecentSessionIds(env, options.cwd);
    const inferredSessionId = inferNewSessionId(beforeSnapshot, afterSnapshot);
    return attachProviderSessionId(result, inferredSessionId);
  }

  private async readRecentSessionIds(env: NodeJS.ProcessEnv, cwd?: string): Promise<string[]> {
    try {
      const result = await executeCommand({
        command: this.resolveCommand(env),
        args: ["session", "list", "--format", "json", "--max-count", "20"],
        cwd,
        env
      });
      if (result.code !== 0) {
        return [];
      }
      return extractSessionIdsFromListOutput(result.stdout);
    } catch {
      return [];
    }
  }
}

function resolveOpenCodeAgentFilePath(agentId: string, env: NodeJS.ProcessEnv): string {
  const configDir = resolveOpenCodeConfigDir(env);
  return path.join(configDir, "agent", `${agentId}.md`);
}

function resolveOpenCodeConfigDir(env: NodeJS.ProcessEnv): string {
  const explicitConfigDir = env.OPENCODE_CONFIG_DIR?.trim();
  if (explicitConfigDir) {
    return explicitConfigDir;
  }

  if (process.platform === "win32") {
    const appDataDir = env.APPDATA?.trim();
    if (appDataDir) {
      return path.join(appDataDir, "opencode");
    }
  }

  const xdgConfigHome = env.XDG_CONFIG_HOME?.trim();
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, "opencode");
  }

  return path.join(resolveHomeDir(env), ".config", "opencode");
}

function resolveHomeDir(env: NodeJS.ProcessEnv): string {
  return env.HOME?.trim() || env.USERPROFILE?.trim() || os.homedir();
}

function renderOpenCodeAgentDefinition(displayName: string): string {
  const safeDescription = JSON.stringify(`${displayName} agent managed by OpenGoat`);
  return [
    "---",
    `description: ${safeDescription}`,
    "mode: subagent",
    "---",
    "",
    `You are ${displayName}, an agent managed by OpenGoat.`,
    "Follow instructions from OpenGoat and the user."
  ].join("\n");
}

function isAlreadyExistsError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "unknown error";
}

function inferNewSessionId(before: string[], after: string[]): string | undefined {
  if (after.length === 0) {
    return undefined;
  }

  const prior = new Set(before);
  const created = after.find((sessionId) => !prior.has(sessionId));
  return created ?? after[0];
}

function extractSessionIdsFromListOutput(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed) as unknown;
  } catch {
    return [];
  }

  return collectSessionIds(payload);
}

function collectSessionIds(value: unknown): string[] {
  const unique = new Set<string>();

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) {
        walk(entry);
      }
      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    const record = node as Record<string, unknown>;
    const directId =
      readSessionId(record.id) ||
      readSessionId(record.sessionId) ||
      readSessionId(record.sessionID);
    if (directId) {
      unique.add(directId);
    }

    for (const nested of Object.values(record)) {
      if (nested && typeof nested === "object") {
        walk(nested);
      }
    }
  };

  walk(value);
  return [...unique];
}

function readSessionId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}
