import type { CliCommand } from "../framework/command.js";

export const pluginEnableCommand: CliCommand = {
  path: ["plugin", "enable"],
  description: "Enable a plugin in OpenClaw-compat state.",
  async run(args, context): Promise<number> {
    const pluginId = args[0]?.trim();
    if (!pluginId) {
      context.stderr.write("Usage: opengoat plugin enable <plugin-id>\n");
      return 1;
    }

    await context.service.enablePlugin(pluginId);
    context.stdout.write(`Enabled plugin: ${pluginId}\n`);
    return 0;
  }
};
