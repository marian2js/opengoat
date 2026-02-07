import type { CliCommand } from "../framework/command.js";

export const skillCommand: CliCommand = {
  path: ["skill"],
  description: "Skill commands (list/install).",
  async run(args, context): Promise<number> {
    if (args[0] === "--help" || args[0] === "-h" || args[0] === "help" || args.length === 0) {
      printHelp(context.stdout);
      return 0;
    }

    context.stderr.write(`Unknown skill command: ${args.join(" ")}\n`);
    printHelp(context.stderr);
    return 1;
  }
};

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat skill list [--agent <id> | --global] [--json]\n");
  output.write(
    "  opengoat skill install <name> [--agent <id> | --global] [--from <path>] [--description <text>] [--json]\n"
  );
}
