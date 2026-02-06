import type { CliCommand } from "../framework/command.js";
import { executeAgentRun } from "./agent-run.shared.js";

const DEFAULT_AGENT_ID = "orchestrator";

export const agentCommand: CliCommand = {
  path: ["agent"],
  description: "Send a message to an agent (default: orchestrator).",
  async run(args, context): Promise<number> {
    if (isHelpRequest(args)) {
      printHelp(context.stdout);
      return 0;
    }

    const parsed = parseAgentArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    return executeAgentRun(parsed, context);
  }
};

type AgentArgsResult =
  | {
      ok: true;
      agentId: string;
      message: string;
      model?: string;
      passthroughArgs: string[];
      stream: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseAgentArgs(args: string[]): AgentArgsResult {
  let agentId = DEFAULT_AGENT_ID;
  let working = args;

  const first = args[0]?.trim();
  if (first && !first.startsWith("-")) {
    agentId = first;
    working = args.slice(1);
  }

  const passthroughSeparator = working.indexOf("--");
  const known = passthroughSeparator >= 0 ? working.slice(0, passthroughSeparator) : working;
  const passthroughArgs = passthroughSeparator >= 0 ? working.slice(passthroughSeparator + 1) : [];

  let message: string | undefined;
  let model: string | undefined;
  let stream = true;

  for (let index = 0; index < known.length; index += 1) {
    const token = known[index];

    if (token === "--no-stream") {
      stream = false;
      continue;
    }

    if (token === "--message") {
      const value = known[index + 1];
      if (!value) {
        return { ok: false, error: "Missing value for --message." };
      }
      message = value;
      index += 1;
      continue;
    }

    if (token === "--model") {
      const value = known[index + 1];
      if (!value) {
        return { ok: false, error: "Missing value for --model." };
      }
      model = value;
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  if (!message?.trim()) {
    return { ok: false, error: "--message is required." };
  }

  return {
    ok: true,
    agentId,
    message: message.trim(),
    model,
    passthroughArgs,
    stream
  };
}

function isHelpRequest(args: string[]): boolean {
  if (args.length === 0) {
    return false;
  }

  const first = args[0];
  if (first === "--help" || first === "-h" || first === "help") {
    return true;
  }

  return args.length > 1 && (args[1] === "--help" || args[1] === "-h" || args[1] === "help");
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write(
    "  opengoat agent [agent-id] --message <text> [--model <model>] [--no-stream] [-- <provider-args>]\n"
  );
  output.write("\n");
  output.write("Defaults:\n");
  output.write(`  agent-id defaults to ${DEFAULT_AGENT_ID}\n`);
  output.write("\n");
  output.write("Subcommands:\n");
  output.write("  agent create        Create an agent workspace and internal config.\n");
  output.write("  agent list          List known agents.\n");
  output.write("  agent provider get  Show which provider is assigned to an agent.\n");
  output.write("  agent provider set  Assign one provider to an agent.\n");
  output.write("  agent run           Explicit run command (requires <agent-id>).\n");
}

