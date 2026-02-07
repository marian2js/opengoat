import type { ProviderAuthOptions, ProviderInvokeOptions } from "../../types.js";
import { BaseCliProvider } from "../../cli-provider.js";

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
}
