import { DEFAULT_AGENT_ID } from "../../../core/domain/agent-id.js";
import type { CliCommand } from "../framework/command.js";

export const skillListCommand: CliCommand = {
  path: ["skill", "list"],
  description: "List installed skills for one agent.",
  async run(args, context): Promise<number> {
    const parsed = parseListArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write("Usage: opengoat skill list [--agent <id>] [--json]\n");
      return 1;
    }

    const skills = await context.service.listSkills(parsed.agentId);
    if (parsed.json) {
      context.stdout.write(
        `${JSON.stringify(
          {
            agentId: parsed.agentId,
            count: skills.length,
            skills: skills.map((skill) => ({
              id: skill.id,
              name: skill.name,
              description: skill.description,
              source: skill.source,
              path: skill.skillFilePath
            }))
          },
          null,
          2
        )}\n`
      );
      return 0;
    }

    context.stdout.write(`Agent: ${parsed.agentId}\n`);
    if (skills.length === 0) {
      context.stdout.write("No skills installed.\n");
      context.stdout.write(
        "Install one with: opengoat skill install <name> [--agent <id>] [--from <path>]\n"
      );
      return 0;
    }

    for (const skill of skills) {
      context.stdout.write(`- ${skill.id} [${skill.source}] ${skill.description}\n`);
      context.stdout.write(`  ${skill.skillFilePath}\n`);
    }
    return 0;
  }
};

type ParsedArgs =
  | {
      ok: true;
      agentId: string;
      json: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseListArgs(args: string[]): ParsedArgs {
  let agentId = DEFAULT_AGENT_ID;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--json") {
      json = true;
      continue;
    }
    if (token === "--agent") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --agent." };
      }
      agentId = value.toLowerCase();
      index += 1;
      continue;
    }
    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    agentId,
    json
  };
}
