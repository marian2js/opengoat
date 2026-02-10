import type { CliCommand } from "../framework/command.js";

export const agentProviderGetCommand: CliCommand = {
  path: ["agent", "provider", "get"],
  description: "Get agent provider binding via OpenClaw passthrough.",
  async run(args, context): Promise<number> {
    const agentId = args[0]?.trim();
    if (!agentId) {
      context.stderr.write("Usage: opengoat agent provider get <agent-id>\n");
      return 1;
    }

    const result = await context.service.runOpenClaw(["agents", "provider", "get", agentId, ...args.slice(1)]);
    if (result.stdout.trim()) {
      context.stdout.write(result.stdout);
    }
    if (result.stderr.trim()) {
      context.stderr.write(result.stderr);
    }
    return result.code;
  }
};
