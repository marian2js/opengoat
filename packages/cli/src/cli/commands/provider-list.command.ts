import type { CliCommand } from "../framework/command.js";

export const providerListCommand: CliCommand = {
  path: ["provider", "list"],
  description: "List providers available in OpenGoat.",
  async run(args, context): Promise<number> {
    if (args.length > 0) {
      const invalid = args[0];
      if (invalid === "--help" || invalid === "-h" || invalid === "help") {
        printHelp(context.stdout);
        return 0;
      }
      context.stderr.write(`Unknown option: ${invalid}\n`);
      printHelp(context.stderr);
      return 1;
    }

    const providers = await context.service.listProviders();
    for (const provider of providers) {
      context.stdout.write(
        `${provider.id} (${provider.displayName}) [${provider.kind}]\n`,
      );
    }
    return 0;
  }
};

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage: opengoat provider list\n");
}
