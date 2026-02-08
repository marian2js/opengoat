import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ProviderAuthOptions,
  ProviderCreateAgentOptions,
  ProviderExecutionResult,
  ProviderInvokeOptions
} from "../../types.js";
import { BaseCliProvider } from "../../cli-provider.js";

export class ClaudeProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "claude",
      displayName: "Claude Code",
      kind: "cli",
      command: "claude",
      commandEnvVar: "CLAUDE_CMD",
      capabilities: {
        agent: true,
        model: true,
        auth: true,
        passthrough: true,
        agentCreate: true
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

  public override async createAgent(
    options: ProviderCreateAgentOptions
  ): Promise<ProviderExecutionResult> {
    const env = options.env ?? process.env;
    const agentFilePath = resolveClaudeAgentFilePath(options.agentId, env);

    try {
      await mkdir(path.dirname(agentFilePath), { recursive: true });
      const definition = renderClaudeAgentDefinition(options.agentId, options.displayName);
      await writeFile(agentFilePath, definition, { encoding: "utf-8", flag: "wx" });
      return {
        code: 0,
        stdout: `Created Claude agent '${options.agentId}' at ${agentFilePath}\n`,
        stderr: ""
      };
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        return {
          code: 0,
          stdout: `Claude agent '${options.agentId}' already exists at ${agentFilePath}\n`,
          stderr: ""
        };
      }

      return {
        code: 1,
        stdout: "",
        stderr: `Failed to create Claude agent '${options.agentId}': ${formatErrorMessage(error)}\n`
      };
    }
  }
}

function resolveClaudeAgentFilePath(agentId: string, env: NodeJS.ProcessEnv): string {
  const explicitAgentsDir = env.CLAUDE_AGENTS_DIR?.trim();
  if (explicitAgentsDir) {
    return path.join(explicitAgentsDir, `${agentId}.md`);
  }

  const explicitConfigDir = env.CLAUDE_CONFIG_DIR?.trim();
  if (explicitConfigDir) {
    return path.join(explicitConfigDir, "agents", `${agentId}.md`);
  }

  const homeDir = resolveHomeDir(env);
  return path.join(homeDir, ".claude", "agents", `${agentId}.md`);
}

function resolveHomeDir(env: NodeJS.ProcessEnv): string {
  return env.HOME?.trim() || env.USERPROFILE?.trim() || os.homedir();
}

function renderClaudeAgentDefinition(agentId: string, displayName: string): string {
  const safeId = JSON.stringify(agentId);
  const safeDescription = JSON.stringify(`${displayName} agent managed by OpenGoat`);
  return [
    "---",
    `name: ${safeId}`,
    `description: ${safeDescription}`,
    "---",
    "",
    `You are ${displayName}, an agent managed by OpenGoat.`,
    "Follow instructions from OpenGoat and the user."
  ].join("\n");
}

function isAlreadyExistsError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "unknown error";
}
