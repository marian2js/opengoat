import path from "node:path";
import { executeCommand } from "../../command-executor.js";
import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type { ProviderAuthOptions, ProviderExecutionResult, ProviderInvocation, ProviderInvokeOptions } from "../../types.js";

export class CursorProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "cursor",
      displayName: "Cursor",
      kind: "cli",
      command: "cursor",
      commandEnvVar: "CURSOR_CMD",
      capabilities: {
        agent: false,
        model: false,
        auth: true,
        passthrough: true
      }
    });
  }

  protected buildInvocationArgs(options: ProviderInvokeOptions, command: string): string[] {
    const payload: string[] = [];
    if (options.providerSessionId?.trim()) {
      payload.push("--resume", options.providerSessionId.trim());
    }

    payload.push(...(options.passthroughArgs ?? []), options.message);

    if (isCursorAgentCommand(command)) {
      return payload;
    }

    return ["agent", ...payload];
  }

  protected override buildAuthInvocationArgs(options: ProviderAuthOptions, command: string): string[] {
    const payload = ["login", ...(options.passthroughArgs ?? [])];

    if (isCursorAgentCommand(command)) {
      return payload;
    }

    return ["agent", ...payload];
  }

  public override buildInvocation(
    options: ProviderInvokeOptions,
    env: NodeJS.ProcessEnv = process.env
  ): ProviderInvocation {
    return super.buildInvocation(options, env);
  }

  public override buildAuthInvocation(
    options: ProviderAuthOptions = {},
    env: NodeJS.ProcessEnv = process.env
  ): ProviderInvocation {
    return super.buildAuthInvocation(options, env);
  }

  public override async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    const env = options.env ?? process.env;
    const requestedSessionId = options.providerSessionId?.trim();
    let effectiveSessionId = requestedSessionId;

    if (!effectiveSessionId && options.forceNewProviderSession) {
      effectiveSessionId = await this.createChatSessionId(env, options.cwd);
    }

    const result = await super.invoke({
      ...options,
      providerSessionId: effectiveSessionId
    });

    return attachProviderSessionId(result, effectiveSessionId);
  }

  private async createChatSessionId(env: NodeJS.ProcessEnv, cwd?: string): Promise<string | undefined> {
    const command = this.resolveCommand(env);
    const args = isCursorAgentCommand(command) ? ["create-chat"] : ["agent", "create-chat"];

    try {
      const result = await executeCommand({
        command,
        args,
        cwd,
        env
      });
      if (result.code !== 0) {
        return undefined;
      }
      const firstLine = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => Boolean(line));
      return firstLine || undefined;
    } catch {
      return undefined;
    }
  }
}

function isCursorAgentCommand(command: string): boolean {
  const executable = path.basename(command).toLowerCase();
  return executable === "cursor-agent" || executable === "cursor-agent.exe";
}
