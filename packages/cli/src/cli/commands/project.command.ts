import type { CliCommand } from "../framework/command.js";

export const projectCommand: CliCommand = {
  path: ["project"],
  description: "Manage OpenGoat projects and their special agents.",
  async run(args, context): Promise<number> {
    if (
      args.length === 0 ||
      args[0] === "--help" ||
      args[0] === "-h" ||
      args[0] === "help"
    ) {
      printHelp(context.stdout);
      return 0;
    }

    context.stderr.write(`Unknown project command: ${args.join(" ")}\n`);
    printHelp(context.stderr);
    return 1;
  },
};

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat project create <url>\n");
}
