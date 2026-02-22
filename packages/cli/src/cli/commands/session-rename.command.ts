import type { CliCommand } from "../framework/command.js";
import { resolveCliDefaultAgentId } from "./default-agent.js";

export const sessionRenameCommand: CliCommand = {
  path: ["session", "rename"],
  description: "Rename one session.",
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
    const result = await context.service.renameSession(agentId, parsed.title, parsed.sessionRef);
    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }

    context.stdout.write(`Renamed session ${result.sessionKey}\n`);
    context.stdout.write(`Session id: ${result.sessionId}\n`);
    context.stdout.write(`Title: ${result.title}\n`);
    return 0;
  }
};

type Parsed =
  | { ok: true; help: boolean; json: boolean; agentId?: string; sessionRef?: string; title: string }
  | { ok: false; error: string };

function parseArgs(args: string[]): Parsed {
  let help = false;
  let json = false;
  let agentId: string | undefined;
  let sessionRef: string | undefined;
  let title = "";

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
    if (token === "--title") {
      const value = args[index + 1];
      if (!value?.trim()) {
        return { ok: false, error: "Missing value for --title." };
      }
      title = value.trim();
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  if (!help && !title) {
    return { ok: false, error: "Missing required option: --title <text>." };
  }

  return {
    ok: true,
    help,
    json,
    agentId,
    sessionRef,
    title
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat session rename --title <text> [--agent <id>] [--session <key|id>] [--json]\n");
  output.write("\n");
  output.write("Defaults: agent-id=config defaultAgent / OPENGOAT_DEFAULT_AGENT / ceo, session=main\n");
}
