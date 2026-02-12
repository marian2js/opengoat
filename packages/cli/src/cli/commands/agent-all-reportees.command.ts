import type { CliCommand } from "../framework/command.js";

export const agentAllReporteesCommand: CliCommand = {
  path: ["agent", "all-reportees"],
  description: "List all reportees for one agent recursively (one id per line).",
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

    const reportees = await context.service.listAllReportees(parsed.agentId);
    for (const reportee of reportees) {
      context.stdout.write(`${reportee}\n`);
    }
    return 0;
  }
};

type ParsedArgs =
  | {
      ok: true;
      help: boolean;
      agentId: string;
    }
  | {
      ok: false;
      error: string;
    };

function parseArgs(args: string[]): ParsedArgs {
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return {
      ok: true,
      help: true,
      agentId: ""
    };
  }

  if (args.some((token) => token?.startsWith("--"))) {
    const invalid = args.find((token) => token?.startsWith("--"));
    return {
      ok: false,
      error: `Unknown option: ${invalid}`
    };
  }

  const agentId = args[0]?.trim().toLowerCase();
  if (!agentId) {
    return {
      ok: false,
      error: "Missing required <agent-id>."
    };
  }

  if (args.length > 1) {
    return {
      ok: false,
      error: "Only one positional argument is allowed: <agent-id>."
    };
  }

  return {
    ok: true,
    help: false,
    agentId
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage: opengoat agent all-reportees <agent-id>\n");
}
