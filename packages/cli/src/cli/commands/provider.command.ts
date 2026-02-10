import type { CliCommand } from "../framework/command.js";

export const providerCommand: CliCommand = {
  path: ["provider"],
  description: "Provider passthrough commands delegated to OpenClaw.",
  async run(args, context): Promise<number> {
    if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
      printHelp(context.stdout);
      return 0;
    }

    context.stderr.write(`Unknown provider command: ${args.join(" ")}\n`);
    printHelp(context.stderr);
    return 1;
  }
};

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat provider list [-- ...]\n");
  output.write("\n");
  output.write("Notes:\n");
  output.write("  - This command is a direct passthrough to OpenClaw CLI provider commands.\n");
}
