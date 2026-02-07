import type { CliCommand } from "../framework/command.js";

export const agentProviderSetCommand: CliCommand = {
  path: ["agent", "provider", "set"],
  description: "Assign one provider to an agent.",
  async run(args, context): Promise<number> {
    const agentId = args[0]?.trim();
    const providerId = args[1]?.trim();

    if (!agentId || !providerId) {
      context.stderr.write("Usage: opengoat agent provider set <agent-id> <provider-id>\n");
      return 1;
    }

    const binding = await context.service.setAgentProvider(agentId, providerId);
    context.stdout.write(`Provider for ${binding.agentId} set to ${binding.providerId}\n`);
    return 0;
  }
};
