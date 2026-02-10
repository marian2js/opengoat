import type { CliCommand } from "../framework/command.js";

export const agentProviderSetCommand: CliCommand = {
  path: ["agent", "provider", "set"],
  description: "Set agent provider binding via OpenClaw passthrough.",
  async run(args, context): Promise<number> {
    const agentId = args[0]?.trim();
    const providerId = args[1]?.trim();

    if (!agentId || !providerId) {
      context.stderr.write("Usage: opengoat agent provider set <agent-id> <provider-id>\n");
      return 1;
    }

    const result = await context.service.runOpenClaw(["agents", "provider", "set", agentId, providerId, ...args.slice(2)]);
    if (result.stdout.trim()) {
      context.stdout.write(result.stdout);
    }
    if (result.stderr.trim()) {
      context.stderr.write(result.stderr);
    }
    return result.code;
  }
};
