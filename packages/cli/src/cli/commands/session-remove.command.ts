import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";

export const sessionRemoveCommand: CliCommand = {
  path: ["session", "remove"],
  description: "Remove one session.",
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
    const result = await context.service.removeSession(agentId, parsed.sessionRef);
    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    context.stdout.write(`Removed session ${result.sessionKey}\n`);
    context.stdout.write(`Session id: ${result.sessionId}\n`);
    context.stdout.write(`Title: ${result.title}\n`);
    context.stdout.write(`Transcript: ${result.transcriptPath}\n`);
    return 0;
  }
};

type Parsed =
  | { ok: true; help: boolean; json: boolean; agentId?: string; sessionRef?: string }
  | { ok: false; error: string };

function parseArgs(args: string[]): Parsed {
  let help = false;
  let json = false;
  let agentId: string | undefined;
  let sessionRef: string | undefined;

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

    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    help,
    json,
    agentId,
    sessionRef
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat session remove [--agent <id>] [--session <key|id>] [--json]\n");
  output.write("\n");
  output.write("Defaults: agent-id=config defaultAgent / OPENGOAT_DEFAULT_AGENT / ceo, session=main\n");
}
