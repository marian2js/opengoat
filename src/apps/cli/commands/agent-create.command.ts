import type { CliCommand } from "../framework/command.js";

export const agentCreateCommand: CliCommand = {
  path: ["agent", "create"],
  description: "Create an agent workspace and internal config (Markdown + JSON).",
  async run(args, context): Promise<number> {
    if (args.includes("--set-default")) {
      context.stderr.write("`--set-default` is not supported. Orchestrator is always the default agent.\n");
      return 1;
    }

    const name = args.join(" ").trim();

    if (!name) {
      context.stderr.write("Usage: opengoat agent create <name>\n");
      return 1;
    }

    const result = await context.service.createAgent(name);

    context.stdout.write(`Agent created: ${result.agent.displayName} (${result.agent.id})\n`);
    context.stdout.write(`Workspace: ${result.agent.workspaceDir}\n`);
    context.stdout.write(`Internal config: ${result.agent.internalConfigDir}\n`);
    context.stdout.write(`Created: ${result.createdPaths.length} path(s)\n`);

    return 0;
  }
};
