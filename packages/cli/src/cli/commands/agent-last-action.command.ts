import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";

export const agentLastActionCommand: CliCommand = {
  path: ["agent", "last-action"],
  description: "Show the last AI action timestamp for an agent.",
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
    const result = await context.service.getAgentLastAction(agentId);
    if (parsed.json) {
      context.stdout.write(
        `${JSON.stringify(result ? { ...result, iso: new Date(result.timestamp).toISOString() } : null, null, 2)}\n`
      );
      return 0;
    }

    if (!result) {
      context.stdout.write(`No AI actions found for agent "${agentId}".\n`);
      return 0;
    }

    context.stdout.write(`Agent: ${result.agentId}\n`);
    context.stdout.write(`Last AI action: ${new Date(result.timestamp).toISOString()}\n`);
    context.stdout.write(`Session key: ${result.sessionKey}\n`);
    context.stdout.write(`Session id: ${result.sessionId}\n`);
    context.stdout.write(`Transcript: ${result.transcriptPath}\n`);
    return 0;
  }
};

type Parsed =
  | {
    ok: true;
    help: boolean;
    json: boolean;
    agentId?: string;
  }
  | {
    ok: false;
    error: string;
  };

function parseArgs(args: string[]): Parsed {
  let help = false;
  let json = false;
  let agentId: string | undefined;
  let agentSet = false;

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
      return {
        ok: false,
        error: `Unknown option: ${token}`
      };
    }

    if (agentSet) {
      return {
        ok: false,
        error: `Unexpected argument: ${token}`
      };
    }

    agentId = token.trim().toLowerCase();
    if (!agentId) {
      return {
        ok: false,
        error: "Agent id cannot be empty."
      };
    }
    agentSet = true;
  }

  return {
    ok: true,
    help,
    json,
    agentId
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat agent last-action [agent-id] [--json]\n");
  output.write("\n");
  output.write("Defaults: agent-id=config defaultAgent / OPENGOAT_DEFAULT_AGENT / ceo\n");
}
