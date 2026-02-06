import type { CliCommand } from "../framework/command.js";
import { executeAgentRun } from "./agent-run.shared.js";

export const agentRunCommand: CliCommand = {
  path: ["agent", "run"],
  description: "Run a message through an agent's configured provider.",
  async run(args, context): Promise<number> {
    const parsed = parseRunArgs(args);

    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write(
        "Usage: opengoat agent run <agent-id> --message <text> [--model <model>] [--no-stream] [-- <provider-args>]\n"
      );
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
      model?: string;
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
