import type { CliCommand } from "../framework/command.js";
import { startOpenGoatAcpServer } from "@opengoat/core";
import { resolveCliDefaultAgentId } from "./default-agent.js";

export const acpCommand: CliCommand = {
  path: ["acp"],
  description: "Run ACP server over stdio for editor integration.",
  async run(args, context): Promise<number> {
    const parsed = parseAcpArgs(args);
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
    const defaultAgentId = parsed.agentId ?? (await resolveCliDefaultAgentId(context));
    const server = startOpenGoatAcpServer(context.service, {
      defaultAgentId,
      defaultSessionKeyPrefix: parsed.sessionKeyPrefix,
      replayHistoryLimit: parsed.replayHistoryLimit,
      verbose: parsed.verbose
    });

    if (parsed.verbose) {
      context.stderr.write("OpenGoat ACP server started on stdio.\n");
    }

    await server.closed;
    return 0;
  }
};

type ParsedAcpArgs =
  | {
      ok: true;
      help: boolean;
      verbose: boolean;
      agentId?: string;
      sessionKeyPrefix?: string;
      replayHistoryLimit?: number;
    }
  | {
      ok: false;
      error: string;
    };

function parseAcpArgs(args: string[]): ParsedAcpArgs {
  let help = false;
  let verbose = false;
  let agentId: string | undefined;
  let sessionKeyPrefix: string | undefined;
  let replayHistoryLimit: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--help" || token === "-h" || token === "help") {
      help = true;
      continue;
    }
    if (token === "--verbose" || token === "-v") {
      verbose = true;
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
    if (token === "--session-prefix") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --session-prefix." };
      }
      sessionKeyPrefix = value;
      index += 1;
      continue;
    }
    if (token === "--history-limit") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        return { ok: false, error: "Invalid value for --history-limit." };
      }
      replayHistoryLimit = Math.floor(value);
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    help,
    verbose,
    agentId,
    sessionKeyPrefix,
    replayHistoryLimit
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat acp [--agent <id>] [--session-prefix <prefix>] [--history-limit <n>] [--verbose]\n");
  output.write("\n");
  output.write("Starts an ACP server over stdio for editor/IDE integration.\n");
}
