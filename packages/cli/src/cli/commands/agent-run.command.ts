import type { CliCommand } from "../framework/command.js";
import { executeAgentRun } from "./agent-run.shared.js";

export const agentRunCommand: CliCommand = {
  path: ["agent", "run"],
  description: "Run a message through an OpenClaw-backed agent.",
  async run(args, context): Promise<number> {
    const parsed = parseRunArgs(args);

    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write(
        "Usage: opengoat agent run <agent-id> --message <text> [--image <path>] [--session <key|id>] [--new-session|--no-session]\n"
      );
      context.stderr.write("       [--model <model>] [--no-stream] [-- <runtime-args>]\n");
      return 1;
    }

    return executeAgentRun(parsed, context);
  }
};

type RunArgsResult =
  | {
      ok: true;
      agentId: string;
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

function parseRunArgs(args: string[]): RunArgsResult {
  const agentId = args[0]?.trim();
  if (!agentId) {
    return { ok: false, error: "Missing <agent-id>." };
  }

  const flagArgs = args.slice(1);
  const passthroughSeparator = flagArgs.indexOf("--");
  const known = passthroughSeparator >= 0 ? flagArgs.slice(0, passthroughSeparator) : flagArgs;
  const passthroughArgs = passthroughSeparator >= 0 ? flagArgs.slice(passthroughSeparator + 1) : [];

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
