import type { CliCommand } from "../framework/command.js";

export const agentCreateCommand: CliCommand = {
  path: ["agent", "create"],
  description: "Create an OpenClaw-backed agent in OpenGoat.",
  async run(args, context): Promise<number> {
    const parsed = parseAgentCreateArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    if (parsed.help) {
      printHelp(context.stdout);
      return 0;
    }

    const result = await context.service.createAgent(parsed.name, {
      type: parsed.type,
      reportsTo: parsed.reportsTo,
      skills: parsed.skills,
      role: parsed.role
    });

    context.stdout.write(`Agent ready: ${result.agent.displayName} (${result.agent.id})\n`);
    context.stdout.write(`Role: ${result.agent.role}\n`);
    context.stdout.write(`Workspace: ${result.agent.workspaceDir}\n`);
    context.stdout.write(`Internal config: ${result.agent.internalConfigDir}\n`);
    if (result.alreadyExisted) {
      context.stdout.write("Local agent already existed; OpenClaw sync was still attempted.\n");
    }
    if (result.runtimeSync) {
      context.stdout.write(`OpenClaw sync: ${result.runtimeSync.runtimeId} (code ${result.runtimeSync.code})\n`);
    }
    return 0;
  }
};

interface ParsedAgentCreateArgs {
  ok: boolean;
  error?: string;
  help?: boolean;
  name: string;
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
  role?: string;
}

function parseAgentCreateArgs(args: string[]): ParsedAgentCreateArgs {
  const nameParts: string[] = [];
  let type: "manager" | "individual" | undefined;
  let reportsTo: string | null | undefined;
  const skills: string[] = [];
  let role: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token) {
      continue;
    }

    if (token === "--help" || token === "-h") {
      return {
        ok: true,
        help: true,
        name: ""
      };
    }

    if (token === "--manager") {
      type = "manager";
      continue;
    }

    if (token === "--individual" || token === "--specialist") {
      type = "individual";
      continue;
    }

    if (token === "--reports-to") {
      const value = args[index + 1]?.trim();
      if (!value || value.startsWith("--")) {
        return {
          ok: false,
          error: "Missing value for --reports-to.",
          name: ""
        };
      }
      reportsTo = value.toLowerCase() === "none" ? null : value.toLowerCase();
      index += 1;
      continue;
    }

    if (token === "--skill") {
      const value = args[index + 1]?.trim();
      if (!value || value.startsWith("--")) {
        return {
          ok: false,
          error: "Missing value for --skill.",
          name: ""
        };
      }
      skills.push(value.toLowerCase());
      index += 1;
      continue;
    }

    if (token === "--role") {
      const value = args[index + 1]?.trim();
      if (!value || value.startsWith("--")) {
        return {
          ok: false,
          error: "Missing value for --role.",
          name: ""
        };
      }
      role = value;
      index += 1;
      continue;
    }

    if (token.startsWith("--")) {
      return {
        ok: false,
        error: `Unknown option: ${token}`,
        name: ""
      };
    }

    nameParts.push(token);
  }

  const name = nameParts.join(" ").trim();
  if (!name) {
    return {
      ok: false,
      error: "Missing required <name>.",
      name: ""
    };
  }

  return {
    ok: true,
    name,
    type,
    reportsTo,
    skills: dedupeSkills(type, skills),
    role
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage: opengoat agent create <name> [--manager|--individual] [--role <title>] [--reports-to <agent-id|none>] [--skill <skill-id>]\n");
  output.write("Defaults: new agents report to ceo when --reports-to is omitted.\n");
}

function dedupeSkills(_type: "manager" | "individual" | undefined, input: string[]): string[] | undefined {
  if (input.length === 0) {
    return undefined;
  }
  return [...new Set(input)].sort((left, right) => left.localeCompare(right));
}
