import type { CliCommand } from "../framework/command.js";

export const agentProviderGetCommand: CliCommand = {
  path: ["agent", "provider", "get"],
  description: "Show which provider is assigned to an agent.",
  async run(args, context): Promise<number> {
    const agentId = args[0]?.trim();
    if (!agentId) {
      context.stderr.write("Usage: opengoat agent provider get <agent-id>\n");
      return 1;
    }

    const binding = await context.service.getAgentProvider(agentId);
    context.stdout.write(`${binding.agentId}\t${binding.providerId}\n`);
    return 0;
  }
};
