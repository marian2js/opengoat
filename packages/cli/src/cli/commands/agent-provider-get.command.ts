import type { CliCommand } from "../framework/command.js";

export const agentProviderGetCommand: CliCommand = {
  path: ["agent", "provider", "get"],
  description: "Get the configured provider for one agent.",
  async run(args, context): Promise<number> {
    const agentId = args[0]?.trim();
    if (!agentId) {
      context.stderr.write("Usage: opengoat agent provider get <agent-id>\n");
      return 1;
    }

    if (args.length > 1) {
      const invalid = args[1];
      context.stderr.write(`Unknown option: ${invalid}\n`);
      context.stderr.write("Usage: opengoat agent provider get <agent-id>\n");
      return 1;
    }

    const binding = await context.service.getAgentProvider(agentId);
    context.stdout.write(`${binding.agentId}: ${binding.providerId}\n`);
    return 0;
  }
};
