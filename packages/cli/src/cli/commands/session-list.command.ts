import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";

export const sessionListCommand: CliCommand = {
  path: ["session", "list"],
  description: "List sessions for an agent.",
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

    const agentId = parsed.agentId ?? (await resolveCliDefaultAgentId(context));
    const sessions = await context.service.listSessions(agentId, {
      activeMinutes: parsed.activeMinutes
    });

    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(sessions, null, 2)}\n`);
      return 0;
    }

    if (sessions.length === 0) {
      context.stdout.write("No sessions found.\n");
      return 0;
    }

    for (const session of sessions) {
      context.stdout.write(
        `${session.sessionKey}\t${session.sessionId}\t${session.title}\t${new Date(session.updatedAt).toISOString()}\tcompactions=${session.compactionCount}\n`
      );
    }

    return 0;
  }
};

type Parsed =
  | { ok: true; help: boolean; json: boolean; agentId?: string; activeMinutes?: number }
  | { ok: false; error: string };

function parseArgs(args: string[]): Parsed {
  let help = false;
  let json = false;
  let agentId: string | undefined;
  let activeMinutes: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--help" || token === "-h" || token === "help") {
      help = true;
      continue;
    }
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
    if (token === "--active-minutes") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --active-minutes." };
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false, error: "--active-minutes must be a positive integer." };
      }
      activeMinutes = parsed;
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    help,
    json,
    agentId,
    activeMinutes
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat session list [--agent <id>] [--active-minutes <n>] [--json]\n");
  output.write("\n");
  output.write("Defaults: agent-id=config defaultAgent / OPENGOAT_DEFAULT_AGENT / ceo\n");
}
