import type { CliCommand } from "../framework/command.js";

export const agentInfoCommand: CliCommand = {
  path: ["agent", "info"],
  description: "Show organization info for one agent.",
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

    const info = await context.service.getAgentInfo(parsed.agentId);
    context.stdout.write(`id: ${info.id}\n`);
    context.stdout.write(`name: ${info.name}\n`);
    context.stdout.write(`role: ${info.role}\n`);
    context.stdout.write(`total reportees: ${info.totalReportees}\n`);
    context.stdout.write("direct reportees:\n");
    for (const reportee of info.directReportees) {
      context.stdout.write(
        `- {id: "${reportee.id}", name: "${reportee.name}", role: "${reportee.role}", total reportees: ${reportee.totalReportees}}\n`
      );
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
  output.write("Usage: opengoat agent info <agent-id>\n");
}
