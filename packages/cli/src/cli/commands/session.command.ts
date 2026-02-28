import type { CliCommand } from "../framework/command.js";

export const sessionCommand: CliCommand = {
  path: ["session"],
  description: "Session commands (list/history/reset/compact/rename/remove).",
  async run(args, context): Promise<number> {
    if (args.length === 0 || (args[0] && isHelpToken(args[0]))) {
      printHelp(context.stdout);
      return 0;
    }

    context.stderr.write(`Unknown session command: ${args.join(" ")}\n`);
    printHelp(context.stderr);
    return 1;
  }
};

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat session <command> [options]\n");
  output.write("\n");
  output.write("Defaults:\n");
  output.write("  agent-id defaults to config defaultAgent / OPENGOAT_DEFAULT_AGENT / goat\n");
  output.write("  session defaults to agent main session\n");
  output.write("\n");
  output.write("Commands:\n");
  output.write("  session list      List sessions for one agent.\n");
  output.write("  session history   Show transcript history for one session.\n");
  output.write("  session reset     Start a fresh session id for one session key.\n");
  output.write("  session compact   Force transcript compaction for one session.\n");
  output.write("  session rename    Rename one session.\n");
  output.write("  session remove    Remove one session.\n");
}

function isHelpToken(value: string): boolean {
  return value === "help" || value === "--help" || value === "-h";
}
