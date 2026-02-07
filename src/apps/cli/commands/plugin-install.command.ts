import type { CliCommand } from "../framework/command.js";

export const pluginInstallCommand: CliCommand = {
  path: ["plugin", "install"],
  description: "Install an OpenClaw-compatible plugin.",
  async run(args, context): Promise<number> {
    const parsed = parseInstallArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write("Usage: opengoat plugin install <spec> [--link] [--json]\n");
      return 1;
    }

    const result = await context.service.installPlugin({
      spec: parsed.spec,
      link: parsed.link
    });

    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.code;
    }

    context.stdout.write(`Installed plugin spec: ${parsed.spec}\n`);
    if (result.installedPluginId) {
      context.stdout.write(`Plugin id: ${result.installedPluginId}\n`);
    }
    if (result.stdout.trim()) {
      context.stdout.write(`${result.stdout.trim()}\n`);
    }
    if (result.stderr.trim()) {
      context.stderr.write(`${result.stderr.trim()}\n`);
    }
    return result.code;
  }
};

type ParsedInstallArgs =
  | {
      ok: true;
      spec: string;
      link: boolean;
      json: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseInstallArgs(args: string[]): ParsedInstallArgs {
  const spec = args[0]?.trim();
  if (!spec) {
    return { ok: false, error: "Missing <spec>." };
  }

  let link = false;
  let json = false;

  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--link") {
      link = true;
      continue;
    }
    if (token === "--json") {
      json = true;
      continue;
    }
    return { ok: false, error: `Unknown option: ${token}` };
  }

  return {
    ok: true,
    spec,
    link,
    json
  };
}
