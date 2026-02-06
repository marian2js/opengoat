import type { CliCommand } from "../framework/command.js";

export const providerListCommand: CliCommand = {
  path: ["provider", "list"],
  description: "List available providers and capabilities.",
  async run(_args, context): Promise<number> {
    const providers = await context.service.listProviders();

    if (providers.length === 0) {
      context.stdout.write("No providers registered.\n");
      return 0;
    }

    for (const provider of providers) {
      context.stdout.write(
        `${provider.id}\t${provider.kind}\tagent=${provider.capabilities.agent} model=${provider.capabilities.model} auth=${provider.capabilities.auth}\n`
      );
    }

    return 0;
  }
};
