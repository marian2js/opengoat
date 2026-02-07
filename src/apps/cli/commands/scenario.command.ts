import type { CliCommand } from "../framework/command.js";

export const scenarioCommand: CliCommand = {
  path: ["scenario"],
  description: "Scenario commands for end-to-end orchestration tests.",
  async run(args, context): Promise<number> {
    if (args.length === 0 || args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
      printHelp(context.stdout);
      return 0;
    }

    context.stderr.write(`Unknown scenario command: ${args.join(" ")}\n`);
    printHelp(context.stderr);
    return 1;
  }
};

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat scenario run --file <scenario.json> [--mode live|scripted] [--json]\n");
}
