import type { CliCommand } from "../framework/command.js";

export const agentListCommand: CliCommand = {
  path: ["agent", "list"],
  description: "List known agents from ~/.opengoat/workspaces.",
  async run(_args, context): Promise<number> {
    const agents = await context.service.listAgents();

    if (agents.length === 0) {
      context.stdout.write("No agents found. Run: opengoat onboard\n");
      return 0;
    }

    for (const agent of agents) {
      const displayName = agent.displayName.trim();
      if (!displayName || displayName.toLowerCase() === agent.id.toLowerCase()) {
        context.stdout.write(`${agent.id}\n`);
        continue;
      }

      context.stdout.write(`${agent.id} (${displayName})\n`);
    }

    return 0;
  }
};
