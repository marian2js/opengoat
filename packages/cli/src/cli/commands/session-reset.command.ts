import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";

export const sessionResetCommand: CliCommand = {
  path: ["session", "reset"],
  description: "Start a fresh session id for one session key.",
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
    const result = await context.service.resetSession(agentId, parsed.sessionRef);
    context.stdout.write(`Reset session ${result.sessionKey}\n`);
    context.stdout.write(`Session id: ${result.sessionId}\n`);
    context.stdout.write(`Transcript: ${result.transcriptPath}\n`);
    return 0;
  }
};

type Parsed =
  | { ok: true; help: boolean; agentId?: string; sessionRef?: string }
  | { ok: false; error: string };

function parseArgs(args: string[]): Parsed {
  let help = false;
  let agentId: string | undefined;
  let sessionRef: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--help" || token === "-h" || token === "help") {
      help = true;
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
    agentId,
    sessionRef
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat session reset [--agent <id>] [--session <key|id>]\n");
  output.write("\n");
  output.write("Defaults: agent-id=config defaultAgent / OPENGOAT_DEFAULT_AGENT / goat, session=main\n");
}
