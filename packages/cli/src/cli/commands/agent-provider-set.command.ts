import type { CliCommand } from "../framework/command.js";

export const agentProviderSetCommand: CliCommand = {
  path: ["agent", "provider", "set"],
  description: "Set the provider for one agent.",
  async run(args, context): Promise<number> {
    const agentId = args[0]?.trim();
    const providerId = args[1]?.trim();

    if (!agentId || !providerId) {
      context.stderr.write("Usage: opengoat agent provider set <agent-id> <provider-id>\n");
      return 1;
    }

    if (args.length > 2) {
      const invalid = args[2];
      context.stderr.write(`Unknown option: ${invalid}\n`);
      context.stderr.write("Usage: opengoat agent provider set <agent-id> <provider-id>\n");
      return 1;
    }

    const binding = await context.service.setAgentProvider(agentId, providerId);
    context.stdout.write(`${binding.agentId}: ${binding.providerId}\n`);
    return 0;
  }
};
