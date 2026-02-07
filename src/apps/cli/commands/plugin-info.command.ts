import type { CliCommand } from "../framework/command.js";

export const pluginInfoCommand: CliCommand = {
  path: ["plugin", "info"],
  description: "Show details for one plugin.",
  async run(args, context): Promise<number> {
    const parsed = parseInfoArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write("Usage: opengoat plugin info <plugin-id> [--json]\n");
      return 1;
    }

    const plugin = await context.service.getPluginInfo(parsed.pluginId);
    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(plugin, null, 2)}\n`);
      return 0;
    }

    context.stdout.write(`id: ${plugin.id}\n`);
    context.stdout.write(`status: ${plugin.status}\n`);
    context.stdout.write(`enabled: ${plugin.enabled}\n`);
    context.stdout.write(`origin: ${plugin.origin}\n`);
    context.stdout.write(`source: ${plugin.source}\n`);
    if (plugin.description) {
      context.stdout.write(`description: ${plugin.description}\n`);
    }
    if (plugin.error) {
      context.stdout.write(`error: ${plugin.error}\n`);
    }
    return 0;
  }
};

type ParsedInfoArgs =
  | {
      ok: true;
      pluginId: string;
      json: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseInfoArgs(args: string[]): ParsedInfoArgs {
  const pluginId = args[0]?.trim();
  if (!pluginId) {
    return { ok: false, error: "Missing <plugin-id>." };
  }

  let json = false;
  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--json") {
      json = true;
      continue;
    }
    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    pluginId,
    json
  };
}
