import { executeCommand } from "../../command-executor.js";
import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type { ProviderAuthOptions, ProviderExecutionResult, ProviderInvokeOptions } from "../../types.js";

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
        passthrough: true
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
