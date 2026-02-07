import { DEFAULT_AGENT_ID } from "../../../core/domain/agent-id.js";
import type { CliCommand } from "../framework/command.js";

export const skillInstallCommand: CliCommand = {
  path: ["skill", "install"],
  description: "Install one skill into an agent workspace.",
  async run(args, context): Promise<number> {
    const parsed = parseInstallArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write(
        "Usage: opengoat skill install <name> [--agent <id>] [--from <path>] [--description <text>] [--json]\n"
      );
      return 1;
    }

    const result = await context.service.installSkill({
      agentId: parsed.agentId,
      skillName: parsed.skillName,
      sourcePath: parsed.sourcePath,
      description: parsed.description
    });

    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    context.stdout.write(`Installed skill: ${result.skillId}\n`);
    context.stdout.write(`Agent: ${result.agentId}\n`);
    context.stdout.write(`Source: ${result.source}\n`);
    context.stdout.write(`Path: ${result.installedPath}\n`);
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
      agentId: string;
      sourcePath?: string;
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

  let agentId = DEFAULT_AGENT_ID;
  let sourcePath: string | undefined;
  let description: string | undefined;
  let json = false;

  for (let index = 1; index < args.length; index += 1) {
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
    if (token === "--from") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --from." };
      }
      sourcePath = value;
      index += 1;
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

  return {
    ok: true,
    skillName,
    agentId,
    sourcePath,
    description,
    json
  };
}
