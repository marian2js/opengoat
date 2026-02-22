import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";

export const skillRemoveCommand: CliCommand = {
  path: ["skill", "remove"],
  description: "Remove a skill globally or from a specific agent.",
  async run(args, context): Promise<number> {
    const parsed = parseRemoveArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write(
        "Usage: opengoat skill remove <id> [--agent <id> | --global] [--json]\n",
      );
      return 1;
    }

    const agentId = parsed.global
      ? undefined
      : parsed.agentId ?? (await resolveCliDefaultAgentId(context));
    const result = await context.service.removeSkill({
      scope: parsed.global ? "global" : "agent",
      agentId,
      skillId: parsed.skillId,
    });

    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    context.stdout.write(`Removed skill: ${result.skillId}\n`);
    context.stdout.write(`Scope: ${result.scope}\n`);
    if (result.removedFromGlobal) {
      context.stdout.write("Removed from global storage.\n");
    }
    if (result.agentId) {
      context.stdout.write(`Target agent: ${result.agentId}\n`);
    }
    if (result.removedFromAgentIds.length > 0) {
      context.stdout.write(`Removed from agents: ${result.removedFromAgentIds.join(", ")}\n`);
    }
    if (result.removedWorkspacePaths.length > 0) {
      context.stdout.write(`Workspace removals: ${result.removedWorkspacePaths.length}\n`);
    }
    if (
      !result.removedFromGlobal &&
      result.removedFromAgentIds.length === 0 &&
      result.removedWorkspacePaths.length === 0
    ) {
      context.stdout.write("No installed entries were found for that skill.\n");
    }
    return 0;
  },
};

type ParsedArgs =
  | {
      ok: true;
      skillId: string;
      agentId?: string;
      global: boolean;
      json: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseRemoveArgs(args: string[]): ParsedArgs {
  const skillId = args[0]?.trim();
  if (!skillId) {
    return { ok: false, error: "Missing <id>." };
  }

  let agentId: string | undefined;
  let global = false;
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
    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    skillId,
    agentId,
    global,
    json,
  };
}
