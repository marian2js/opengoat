import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type { ProviderAuthOptions, ProviderExecutionResult, ProviderInvokeOptions } from "../../types.js";

export class OpenClawProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "openclaw",
      displayName: "OpenClaw",
      kind: "cli",
      command: "openclaw",
      commandEnvVar: "OPENCLAW_CMD",
      capabilities: {
        agent: true,
        model: true,
        auth: true,
        passthrough: true
      }
    });
  }

  protected buildInvocationArgs(options: ProviderInvokeOptions): string[] {
    const args = ["agent"];

    if (options.agent) {
      args.push(options.agent);
    }

    if (options.providerSessionId?.trim()) {
      args.push("--session-id", options.providerSessionId.trim());
    }

    if (options.model) {
      args.push("--model", options.model);
    }

    args.push(...(options.passthroughArgs ?? []));
    args.push("--message", options.message);

    return args;
  }

  protected override buildAuthInvocationArgs(options: ProviderAuthOptions): string[] {
    const passthrough = options.passthroughArgs ?? [];

    if (passthrough.length > 0) {
      return ["models", "auth", "login", ...passthrough];
    }

    return ["onboard"];
  }

  public override async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    const sessionId = options.providerSessionId?.trim();
    const result = await super.invoke(options);
    return attachProviderSessionId(result, sessionId);
  }
}
