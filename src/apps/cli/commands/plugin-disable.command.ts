import type { CliCommand } from "../framework/command.js";

export const pluginDisableCommand: CliCommand = {
  path: ["plugin", "disable"],
  description: "Disable a plugin in OpenClaw-compat state.",
  async run(args, context): Promise<number> {
    const pluginId = args[0]?.trim();
    if (!pluginId) {
      context.stderr.write("Usage: opengoat plugin disable <plugin-id>\n");
      return 1;
    }

    await context.service.disablePlugin(pluginId);
    context.stdout.write(`Disabled plugin: ${pluginId}\n`);
    return 0;
  }
};
