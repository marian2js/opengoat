import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type {
  ProviderAuthOptions,
  ProviderCreateAgentOptions,
  ProviderDeleteAgentOptions,
  ProviderExecutionResult,
  ProviderInvokeOptions,
} from "../../types.js";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";

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

    return [...resolveOpenClawArguments(options.env), ...args];
  }

  protected override prepareExecutionEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const preferredNodePaths = resolvePreferredCommandPaths(env);
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
      return [
        ...resolveOpenClawArguments(options.env),
        "models",
        "auth",
        "login",
        ...passthrough,
      ];
    }

    return [...resolveOpenClawArguments(options.env), "onboard"];
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

    return [...resolveOpenClawArguments(options.env), ...args];
  }

  protected override buildDeleteAgentInvocationArgs(
    options: ProviderDeleteAgentOptions,
  ): string[] {
    return [
      ...resolveOpenClawArguments(options.env),
      "agents",
      "delete",
      options.agentId,
      "--force",
    ];
  }

  public override async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    const sessionId = options.providerSessionId?.trim();
    const result = await super.invoke(options);
    return attachProviderSessionId(result, sessionId);
  }
}

function resolveOpenClawArguments(env: NodeJS.ProcessEnv | undefined): string[] {
  const raw = env?.OPENCLAW_ARGUMENTS?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
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

function resolvePreferredCommandPaths(env: NodeJS.ProcessEnv): string[] {
  const homeDir = homedir();
  const preferredPaths: string[] = [
    dirname(process.execPath),
    join(homeDir, ".npm-global", "bin"),
    join(homeDir, ".npm", "bin"),
    join(homeDir, ".local", "bin"),
    join(homeDir, ".volta", "bin"),
    join(homeDir, ".fnm", "current", "bin"),
    join(homeDir, ".asdf", "shims"),
    join(homeDir, "bin"),
  ];

  const npmPrefixCandidates = dedupePathEntries([
    env.npm_config_prefix ?? "",
    env.NPM_CONFIG_PREFIX ?? "",
    process.env.npm_config_prefix ?? "",
    process.env.NPM_CONFIG_PREFIX ?? "",
  ]);
  for (const prefix of npmPrefixCandidates) {
    preferredPaths.push(join(prefix, "bin"));
  }

  if (process.platform === "darwin") {
    preferredPaths.push(
      "/opt/homebrew/bin",
      "/opt/homebrew/opt/node@22/bin",
      "/usr/local/opt/node@22/bin",
    );
  }

  return preferredPaths;
}
