import { normalizeAgentId } from "@opengoat/core";
import type { CliCommand } from "../framework/command.js";

export const agentSetDefaultCommand: CliCommand = {
  path: ["agent", "set-default"],
  description: "Set the default entry agent used by OpenGoat.",
  async run(args, context): Promise<number> {
    const parsed = parseArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    if (parsed.help) {
      printHelp(context.stdout);
      return 0;
    }

    await context.service.initialize();
    const updated = await context.service.setDefaultAgent(parsed.agentId);
    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
      return 0;
    }

    context.stdout.write(`Default agent: ${updated.defaultAgent}\n`);
    context.stdout.write(`Previous default: ${updated.previousDefaultAgent}\n`);
    context.stdout.write(`Config: ${updated.configPath}\n`);

    const envOverride = normalizeAgentId(
      process.env.OPENGOAT_DEFAULT_AGENT ?? "",
    );
    if (envOverride && envOverride !== updated.defaultAgent) {
      context.stdout.write(
        `Environment override active: OPENGOAT_DEFAULT_AGENT=${envOverride}\n`,
      );
    }
    return 0;
  },
};

type Parsed =
  | {
      ok: true;
      help: boolean;
      json: boolean;
      agentId: string;
    }
  | { ok: false; error: string };

function parseArgs(args: string[]): Parsed {
  let help = false;
  let json = false;
  let agentId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token) {
      continue;
    }
    if (token === "--help" || token === "-h" || token === "help") {
      help = true;
      continue;
    }
    if (token === "--json") {
      json = true;
      continue;
    }
    if (token.startsWith("-")) {
      return { ok: false, error: `Unknown option: ${token}` };
    }
    if (agentId) {
      return { ok: false, error: `Unexpected argument: ${token}` };
    }
    agentId = token.trim();
  }

  if (help) {
    return {
      ok: true,
      help,
      json,
      agentId: agentId ?? "",
    };
  }

  if (!agentId) {
    return { ok: false, error: "Missing required <agent-id>." };
  }

  return {
    ok: true,
    help,
    json,
    agentId,
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat agent set-default <agent-id> [--json]\n");
  output.write("\n");
  output.write(
    "Sets config.json defaultAgent. OPENGOAT_DEFAULT_AGENT still overrides it when set.\n",
  );
}
