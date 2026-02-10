import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type {
  ProviderAuthOptions,
  ProviderCreateAgentOptions,
  ProviderDeleteAgentOptions,
  ProviderExecutionResult,
  ProviderInvokeOptions,
} from "../../types.js";
import { delimiter } from "node:path";

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
        passthrough: true,
        agentCreate: true,
        agentDelete: true,
      },
    });
  }

  protected buildInvocationArgs(options: ProviderInvokeOptions): string[] {
    const args = ["agent"];

    if (options.agent) {
      args.push("--agent", options.agent);
    }

    if (options.providerSessionId?.trim()) {
      args.push("--session-id", options.providerSessionId.trim());
    }

    if (options.model) {
      args.push("--model", options.model);
    }

    args.push(...(options.passthroughArgs ?? []));
    args.push("--message", options.message);

    // Inject extra arguments from env if present
    const extraArgs = options.env?.OPENCLAW_ARGUMENTS?.trim();
    if (extraArgs) {
      // Simple splitting by space - for more complex cases user should use shell script wrapper
      // or we might need a proper argv parser, but this suffices for simple flags like --remote
      args.push(...extraArgs.split(" ").filter((arg) => arg.trim().length > 0));
    }

    return args;
  }

  protected override prepareExecutionEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    if (process.platform !== "darwin") {
      return env;
    }

    const preferredNodePaths = [
      "/opt/homebrew/bin",
      "/opt/homebrew/opt/node@22/bin",
      "/usr/local/opt/node@22/bin",
    ];
    const mergedPath = dedupePathEntries([
      ...preferredNodePaths,
      ...(env.PATH?.split(delimiter) ?? []),
    ]);

    return {
      ...env,
      PATH: mergedPath.join(delimiter),
    };
  }

  protected override buildAuthInvocationArgs(
    options: ProviderAuthOptions,
  ): string[] {
    const passthrough = options.passthroughArgs ?? [];

    if (passthrough.length > 0) {
      return ["models", "auth", "login", ...passthrough];
    }

    return ["onboard"];
  }

  protected override buildCreateAgentInvocationArgs(
    options: ProviderCreateAgentOptions,
  ): string[] {
    const args = [
      "agents",
      "add",
      options.agentId,
      "--workspace",
      options.workspaceDir,
      "--agent-dir",
      options.internalConfigDir,
      "--non-interactive",
    ];

    const model = options.env?.OPENGOAT_OPENCLAW_MODEL?.trim();
    if (model) {
      args.push("--model", model);
    }

    return args;
  }

  protected override buildDeleteAgentInvocationArgs(
    options: ProviderDeleteAgentOptions,
  ): string[] {
    return ["agents", "delete", options.agentId, "--force"];
  }

  public override async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    const sessionId = options.providerSessionId?.trim();
    const result = await super.invoke(options);
    return attachProviderSessionId(result, sessionId);
  }
}

function dedupePathEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    result.push(entry);
  }

  return result;
}
