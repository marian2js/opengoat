import type { CliCommand } from "../framework/command.js";

export const agentSetManagerCommand: CliCommand = {
  path: ["agent", "set-manager"],
  description: "Change who an agent reports to in the organization hierarchy.",
  async run(args, context): Promise<number> {
    const parsed = parseAgentSetManagerArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    if (parsed.help) {
      printHelp(context.stdout);
      return 0;
    }

    const result = await context.service.setAgentManager(parsed.agentId, parsed.reportsTo);
    context.stdout.write(`Updated manager: ${result.agentId}\n`);
    context.stdout.write(`Previous reports-to: ${result.previousReportsTo ?? "null"}\n`);
    context.stdout.write(`Current reports-to: ${result.reportsTo ?? "null"}\n`);
    context.stdout.write(`Updated paths: ${result.updatedPaths.length}\n`);
    return 0;
  }
};

type ParsedArgs =
  | {
      ok: true;
      help: boolean;
      agentId: string;
      reportsTo: string | null;
    }
  | {
      ok: false;
      error: string;
    };

function parseAgentSetManagerArgs(args: string[]): ParsedArgs {
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return {
      ok: true,
      help: true,
      agentId: "",
      reportsTo: null
    };
  }

  const positional = args.filter((token) => token && !token.startsWith("--"));
  if (positional.length !== args.length) {
    const invalid = args.find((token) => token.startsWith("--"));
    return {
      ok: false,
      error: `Unknown option: ${invalid}`
    };
  }

  const agentId = positional[0]?.trim().toLowerCase();
  const rawReportsTo = positional[1]?.trim().toLowerCase();
  if (!agentId) {
    return {
      ok: false,
      error: "Missing required <agent-id>."
    };
  }
  if (!rawReportsTo) {
    return {
      ok: false,
      error: "Missing required <manager-id|none>."
    };
  }
  if (positional.length > 2) {
    return {
      ok: false,
      error: "Only two positional arguments are allowed: <agent-id> <manager-id|none>."
    };
  }

  return {
    ok: true,
    help: false,
    agentId,
    reportsTo: rawReportsTo === "none" ? null : rawReportsTo
  };
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage: opengoat agent set-manager <agent-id> <manager-id|none>\n");
}
