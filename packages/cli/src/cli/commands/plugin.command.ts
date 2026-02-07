import type { CliCommand } from "../framework/command.js";

export const pluginCommand: CliCommand = {
  path: ["plugin"],
  description: "OpenClaw-compatible plugin commands.",
  async run(args, context): Promise<number> {
    if (
      args.length === 0 ||
      args[0] === "help" ||
      args[0] === "--help" ||
      args[0] === "-h"
    ) {
      printHelp(context.stdout);
      return 0;
    }

    context.stderr.write(`Unknown plugin command: ${args.join(" ")}\n`);
    printHelp(context.stderr);
    return 1;
  },
};

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write(
    "  opengoat plugin list [--enabled] [--verbose] [--all] [--json]\n",
  );
  output.write("  opengoat plugin install <spec> [--link] [--json]\n");
  output.write("  opengoat plugin info <plugin-id> [--json]\n");
  output.write("  opengoat plugin enable <plugin-id>\n");
  output.write("  opengoat plugin disable <plugin-id>\n");
  output.write("  opengoat plugin doctor [--json]\n");
}
