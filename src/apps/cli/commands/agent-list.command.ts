import type { CliCommand } from "../framework/command.js";

export const agentListCommand: CliCommand = {
  path: ["agent", "list"],
  description: "List known agents from ~/.opengoat/workspaces.",
  async run(_args, context): Promise<number> {
    const agents = await context.service.listAgents();

    if (agents.length === 0) {
      context.stdout.write("No agents found. Run: opengoat init\n");
      return 0;
    }

    for (const agent of agents) {
      context.stdout.write(`${agent.id}\t${agent.displayName}\n`);
    }

    return 0;
  }
};
