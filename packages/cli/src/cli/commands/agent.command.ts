import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";
import { executeAgentRun } from "./agent-run.shared.js";

export const agentCommand: CliCommand = {
  path: ["agent"],
  description: "Send a message to an agent (default: configured default agent).",
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

    const agentId = parsed.agentId ?? (await resolveCliDefaultAgentId(context));
    return executeAgentRun(
      {
        ...parsed,
        agentId,
      },
      context,
    );
  }
};

type AgentArgsResult =
  | {
      ok: true;
      agentId?: string;
      message: string;
      images: Array<{ path: string }>;
      model?: string;
      sessionRef?: string;
      forceNewSession: boolean;
      disableSession: boolean;
      passthroughArgs: string[];
      stream: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseAgentArgs(args: string[]): AgentArgsResult {
  let agentId: string | undefined;
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
  const images: Array<{ path: string }> = [];
  let sessionRef: string | undefined;
  let forceNewSession = false;
  let disableSession = false;
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

    if (token === "--session") {
      const value = known[index + 1];
      if (!value) {
        return { ok: false, error: "Missing value for --session." };
      }
      sessionRef = value.trim();
      index += 1;
      continue;
    }

    if (token === "--image") {
      const value = known[index + 1];
      if (!value?.trim()) {
        return { ok: false, error: "Missing value for --image." };
      }
      images.push({ path: value.trim() });
      index += 1;
      continue;
    }

    if (token === "--new-session") {
      forceNewSession = true;
      continue;
    }

    if (token === "--no-session") {
      disableSession = true;
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
  if (forceNewSession && disableSession) {
    return { ok: false, error: "Use either --new-session or --no-session, not both." };
  }
  return {
    ok: true,
    agentId,
    message: message.trim(),
    images,
    model,
    sessionRef,
    forceNewSession,
    disableSession,
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
    "  opengoat agent [agent-id] --message <text> [--image <path>] [--session <key|id>] [--new-session|--no-session]\n"
  );
  output.write("                [--model <model>] [--no-stream] [-- <runtime-args>]\n");
  output.write("\n");
  output.write("Defaults:\n");
  output.write("  agent-id defaults to config defaultAgent / OPENGOAT_DEFAULT_AGENT / goat\n");
  output.write("\n");
  output.write("Subcommands:\n");
  output.write("  agent create        Create an OpenClaw-backed agent.\n");
  output.write("  agent delete        Delete an agent locally and in OpenClaw.\n");
  output.write("  agent list          List known agents.\n");
  output.write("  agent info          Show one agent's organization details.\n");
  output.write("  agent set-default   Set the configured default entry agent.\n");
  output.write("  agent set-manager   Reassign who an agent reports to.\n");
  output.write("  agent direct-reportees  List one manager's direct reportees.\n");
  output.write("  agent all-reportees     List one manager's full report tree.\n");
  output.write("  agent provider get  Show the configured provider binding for an agent.\n");
  output.write("  agent provider set  Update the configured provider binding for an agent.\n");
  output.write("  agent last-action   Show the last AI action timestamp for an agent.\n");
  output.write("  agent run           Explicit run command (requires <agent-id>).\n");
}
