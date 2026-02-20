import { BaseCliProvider } from "../../cli-provider.js";
import type { ProviderInvokeOptions } from "../../types.js";

const COPILOT_AUTONOMY_FLAGS = ["--allow-all"] as const;

export class CopilotCliProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "copilot-cli",
      displayName: "GitHub Copilot CLI",
      kind: "cli",
      command: "copilot",
      commandEnvVar: "COPILOT_CLI_CMD",
      capabilities: {
        agent: false,
        model: true,
        auth: false,
        passthrough: true,
        reportees: false,
        agentCreate: false,
        agentDelete: false,
      },
    });
  }

  protected override buildInvocationArgs(
    options: ProviderInvokeOptions,
    _command: string,
  ): string[] {
    const message = options.message.trim();
    const model = options.model?.trim();
    const providerSessionId = options.providerSessionId?.trim();
    const passthrough = options.passthroughArgs ?? [];
    const args = ["--prompt", message, "--silent"];

    if (providerSessionId) {
      args.push("--resume", providerSessionId);
    }
    if (model) {
      args.push("--model", model);
    }

    args.push(...passthrough);
    args.push(...COPILOT_AUTONOMY_FLAGS);
    return args;
  }
}
