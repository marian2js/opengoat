import type { ProviderInvokeOptions } from "../../types.js";
import { BaseCliProvider } from "../../cli-provider.js";

export class GeminiProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "gemini",
      displayName: "Gemini CLI",
      kind: "cli",
      command: "gemini",
      commandEnvVar: "GEMINI_CMD",
      capabilities: {
        agent: false,
        model: true,
        auth: false,
        passthrough: true
      }
    });
  }

  protected buildInvocationArgs(options: ProviderInvokeOptions): string[] {
    const args: string[] = [];

    const model = options.model?.trim();
    if (model) {
      args.push("--model", model);
    }

    const passthroughArgs = options.passthroughArgs ?? [];
    if (!hasApprovalModeOverride(passthroughArgs)) {
      args.push("--approval-mode", resolveApprovalMode(options.env));
    }

    args.push(...passthroughArgs);
    args.push("--prompt", options.message);

    return args;
  }

  public override buildInvocation(
    options: ProviderInvokeOptions,
    env: NodeJS.ProcessEnv = process.env
  ) {
    const defaultModel = env.GEMINI_MODEL?.trim();
    return super.buildInvocation(
      {
        ...options,
        model: options.model?.trim() || defaultModel || undefined,
        env
      },
      env
    );
  }
}

function hasApprovalModeOverride(args: string[]): boolean {
  for (const arg of args) {
    if (arg === "--yolo" || arg === "-y") {
      return true;
    }
    if (arg === "--approval-mode") {
      return true;
    }
    if (arg.startsWith("--approval-mode=")) {
      return true;
    }
  }
  return false;
}

function resolveApprovalMode(env: NodeJS.ProcessEnv | undefined): string {
  const configured = env?.GEMINI_APPROVAL_MODE?.trim();
  return configured || "yolo";
}
