import type { CliCommand } from "../framework/command.js";

export const initCommand: CliCommand = {
  path: ["init"],
  description: "Initialize ~/.opengoat (usually auto-run by `opengoat onboard`).",
  async run(_args, context): Promise<number> {
    const result = await context.service.initialize();

    context.stdout.write(`OpenGoat home: ${result.paths.homeDir}\n`);
    context.stdout.write(`Default agent: ${result.defaultAgent}\n`);
    context.stdout.write(`Created: ${result.createdPaths.length} path(s)\n`);

    if (result.createdPaths.length > 0) {
      for (const path of result.createdPaths) {
        context.stdout.write(`  + ${path}\n`);
      }
    }

    return 0;
  }
};
