import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";

export const skillInstallCommand: CliCommand = {
  path: ["skill", "install"],
  description: "Install a centralized skill definition and optionally assign it to an agent.",
  async run(args, context): Promise<number> {
    const parsed = parseInstallArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write(
        "Usage: opengoat skill install <name> [--agent <id> | --global] [--from <path> | --from-url <url>] [--source-skill <name>] [--all-agents] [--description <text>] [--json]\n"
      );
      return 1;
    }

    const agentId = parsed.global
      ? undefined
      : parsed.agentId ?? (await resolveCliDefaultAgentId(context));
    const result = await context.service.installSkill({
      agentId,
      skillName: parsed.skillName,
      sourcePath: parsed.sourcePath,
      sourceUrl: parsed.sourceUrl,
      sourceSkillName: parsed.sourceSkillName,
      description: parsed.description,
      scope: parsed.global ? "global" : "agent",
      assignToAllAgents: parsed.allAgents
    });

    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    context.stdout.write(`Installed skill: ${result.skillId}\n`);
    context.stdout.write(`Scope: ${result.scope}\n`);
    if (result.agentId) {
      context.stdout.write(`Assigned to agent: ${result.agentId}\n`);
    }
    if (result.assignedAgentIds && result.assignedAgentIds.length > 0) {
      context.stdout.write(`Assigned agents: ${result.assignedAgentIds.join(", ")}\n`);
    }
    context.stdout.write(`Source: ${result.source}\n`);
    context.stdout.write(`Path: ${result.installedPath}\n`);
    if (result.workspaceInstallPaths && result.workspaceInstallPaths.length > 0) {
      context.stdout.write(`Workspace installs: ${result.workspaceInstallPaths.length}\n`);
    }
    if (result.replaced) {
      context.stdout.write("Existing skill directory was replaced.\n");
    }
    return 0;
  }
};

type ParsedArgs =
  | {
      ok: true;
      skillName: string;
      agentId?: string;
      global: boolean;
      sourcePath?: string;
      sourceUrl?: string;
      sourceSkillName?: string;
      allAgents: boolean;
      description?: string;
      json: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseInstallArgs(args: string[]): ParsedArgs {
  const skillName = args[0]?.trim();
  if (!skillName) {
    return { ok: false, error: "Missing <name>." };
  }

  let agentId: string | undefined;
  let global = false;
  let sourcePath: string | undefined;
  let sourceUrl: string | undefined;
  let sourceSkillName: string | undefined;
  let allAgents = false;
  let description: string | undefined;
  let json = false;

  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--json") {
      json = true;
      continue;
    }
    if (token === "--agent") {
      if (global) {
        return { ok: false, error: "Use either --agent or --global, not both." };
      }
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --agent." };
      }
      agentId = value.toLowerCase();
      index += 1;
      continue;
    }
    if (token === "--global") {
      if (agentId) {
        return { ok: false, error: "Use either --agent or --global, not both." };
      }
      global = true;
      continue;
    }
    if (token === "--from") {
      if (sourceUrl) {
        return { ok: false, error: "Use either --from or --from-url, not both." };
      }
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --from." };
      }
      sourcePath = value;
      index += 1;
      continue;
    }
    if (token === "--from-url") {
      if (sourcePath) {
        return { ok: false, error: "Use either --from or --from-url, not both." };
      }
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --from-url." };
      }
      sourceUrl = value;
      index += 1;
      continue;
    }
    if (token === "--source-skill") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --source-skill." };
      }
      sourceSkillName = value;
      index += 1;
      continue;
    }
    if (token === "--all-agents") {
      allAgents = true;
      continue;
    }
    if (token === "--description") {
      const value = args[index + 1];
      if (!value?.trim()) {
        return { ok: false, error: "Missing value for --description." };
      }
      description = value.trim();
      index += 1;
      continue;
    }
    return { ok: false, error: `Unknown option: ${token}` };
  }

  if (allAgents && !global) {
    return { ok: false, error: "--all-agents requires --global." };
  }

  return {
    ok: true,
    skillName,
    agentId,
    global,
    sourcePath,
    sourceUrl,
    sourceSkillName,
    allAgents,
    description,
    json
  };
}
