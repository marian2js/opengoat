import type { CliCommand } from "../framework/command.js";

export const providerListCommand: CliCommand = {
  path: ["provider", "list"],
  description: "List providers via OpenClaw passthrough.",
  async run(args, context): Promise<number> {
    const result = await context.service.runOpenClaw(["providers", "list", ...args]);
    if (result.stdout.trim()) {
      context.stdout.write(result.stdout);
    }
    if (result.stderr.trim()) {
      context.stderr.write(result.stderr);
    }
    return result.code;
  }
};
