import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";

export const sessionHistoryCommand: CliCommand = {
  path: ["session", "history"],
  description: "Show transcript history for one session.",
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
    const result = await context.service.getSessionHistory(agentId, {
      sessionRef: parsed.sessionRef,
      limit: parsed.limit,
      includeCompaction: parsed.includeCompaction
    });

    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    context.stdout.write(`Session key: ${result.sessionKey}\n`);
    if (result.sessionId) {
      context.stdout.write(`Session id: ${result.sessionId}\n`);
    }
    if (result.transcriptPath) {
      context.stdout.write(`Transcript: ${result.transcriptPath}\n`);
    }
    context.stdout.write("\n");

    if (result.messages.length === 0) {
      context.stdout.write("No transcript messages.\n");
      return 0;
    }

    for (const message of result.messages) {
      const stamp = new Date(message.timestamp).toISOString();
      if (message.type === "compaction") {
        context.stdout.write(`[${stamp}] [COMPACTION] ${message.content}\n`);
      } else {
        context.stdout.write(`[${stamp}] [${message.role?.toUpperCase() ?? "MESSAGE"}] ${message.content}\n`);
      }
    }

    return 0;
  }
};

type Parsed =
  | {
      ok: true;
      help: boolean;
      json: boolean;
      agentId?: string;
      sessionRef?: string;
      includeCompaction: boolean;
      limit?: number;
    }
  | { ok: false; error: string };

function parseArgs(args: string[]): Parsed {
  let help = false;
  let json = false;
  let agentId: string | undefined;
  let sessionRef: string | undefined;
  let includeCompaction = false;
  let limit: number | undefined;

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
    if (token === "--session") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --session." };
      }
      sessionRef = value;
      index += 1;
      continue;
    }
    if (token === "--limit") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --limit." };
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return { ok: false, error: "--limit must be a positive integer." };
      }
      limit = parsed;
      index += 1;
      continue;
    }
    if (token === "--include-compaction") {
      includeCompaction = true;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    help,
    json,
    agentId,
    sessionRef,
    includeCompaction,
    limit
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write(
    "  opengoat session history [--agent <id>] [--session <key|id>] [--limit <n>] [--include-compaction] [--json]\n"
  );
  output.write("\n");
  output.write("Defaults: agent-id=config defaultAgent / OPENGOAT_DEFAULT_AGENT / goat, session=main\n");
}
