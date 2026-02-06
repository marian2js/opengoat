import type { ProviderAuthOptions, ProviderInvokeOptions } from "../../types.js";
import { BaseCliProvider } from "../../cli-provider.js";

export class ClaudeProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "claude",
      displayName: "Claude Code",
      kind: "cli",
      command: "claude",
      commandEnvVar: "OPENGOAT_CLAUDE_CMD",
      capabilities: {
        agent: true,
        model: true,
        auth: true,
        passthrough: true
      }
    });
  }

  protected buildInvocationArgs(options: ProviderInvokeOptions): string[] {
    const args = ["--print"];

    if (options.agent) {
      args.push("--agent", options.agent);
    }

    if (options.model) {
      args.push("--model", options.model);
    }

    args.push(...(options.passthroughArgs ?? []));
    args.push(options.message);

    return args;
  }

  protected override buildAuthInvocationArgs(options: ProviderAuthOptions): string[] {
    return ["setup-token", ...(options.passthroughArgs ?? [])];
  }
}
