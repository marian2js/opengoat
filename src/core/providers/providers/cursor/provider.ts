import path from "node:path";
import type { ProviderAuthOptions, ProviderInvocation, ProviderInvokeOptions } from "../../types.js";
import { BaseCliProvider } from "../../cli-provider.js";

export class CursorProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "cursor",
      displayName: "Cursor",
      kind: "cli",
      command: "cursor",
      commandEnvVar: "OPENGOAT_CURSOR_CMD",
      capabilities: {
        agent: false,
        model: false,
        auth: true,
        passthrough: true
      }
    });
  }

  protected buildInvocationArgs(options: ProviderInvokeOptions, command: string): string[] {
    const payload = [...(options.passthroughArgs ?? []), options.message];

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
}

function isCursorAgentCommand(command: string): boolean {
  const executable = path.basename(command).toLowerCase();
  return executable === "cursor-agent" || executable === "cursor-agent.exe";
}
