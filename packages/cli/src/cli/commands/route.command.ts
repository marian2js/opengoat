import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";

export const routeCommand: CliCommand = {
  path: ["route"],
  description: "Dry-run routing decision for a message.",
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
    const agentId = parsed.agentId ?? (await resolveCliDefaultAgentId(context));
    const decision = await context.service.routeMessage(agentId, parsed.message);

    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
      return 0;
    }

    context.stdout.write("Routing decision\n");
    context.stdout.write(`Entry agent: ${decision.entryAgentId}\n`);
    context.stdout.write(`Target agent: ${decision.targetAgentId}\n`);
    context.stdout.write(`Confidence: ${decision.confidence}\n`);
    context.stdout.write(`Reason: ${decision.reason}\n`);
    context.stdout.write("\n");
    context.stdout.write("Rewritten message\n");
    context.stdout.write(`${decision.rewrittenMessage}\n`);

    if (decision.candidates.length > 0) {
      context.stdout.write("\nCandidates\n");
      for (const candidate of decision.candidates) {
        context.stdout.write(
          `- ${candidate.agentId} (${candidate.agentName}): score=${candidate.score}, reason=${candidate.reason}\n`
        );
      }
    }

    return 0;
  }
};

type ParsedArgs =
  | {
      ok: true;
      help: boolean;
      json: boolean;
      agentId?: string;
      message: string;
    }
  | {
      ok: false;
      error: string;
    };

function parseArgs(args: string[]): ParsedArgs {
  let help = false;
  let json = false;
  let agentId: string | undefined;
  let message: string | undefined;

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

    if (token === "--message") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --message." };
      }
      message = value;
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  if (help) {
    return {
      ok: true,
      help: true,
      json,
      agentId,
      message: message ?? ""
    };
  }

  if (!message) {
    return { ok: false, error: "--message is required." };
  }

  return {
    ok: true,
    help: false,
    json,
    agentId,
    message
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat route --message <text> [--agent <id>] [--json]\n");
  output.write("\n");
  output.write("Defaults:\n");
  output.write("  agent-id defaults to config defaultAgent / OPENGOAT_DEFAULT_AGENT / ceo\n");
}
