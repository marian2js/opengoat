import type { CliCommand } from "../framework/command.js";

export const pluginListCommand: CliCommand = {
  path: ["plugin", "list"],
  description: "List OpenClaw-compatible plugins.",
  async run(args, context): Promise<number> {
    const parsed = parseListArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      context.stderr.write("Usage: opengoat plugin list [--enabled] [--verbose] [--all] [--json]\n");
      return 1;
    }

    const report = await context.service.listPlugins({
      enabledOnly: parsed.enabledOnly,
      verbose: parsed.verbose,
      includeBundled: parsed.includeBundled
    });

    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    }

    if (report.plugins.length === 0) {
      context.stdout.write("No plugins found.\n");
    } else {
      for (const plugin of report.plugins) {
        context.stdout.write(
          `${plugin.id}\t${plugin.status}\tenabled=${plugin.enabled}\torigin=${plugin.origin}\tsource=${plugin.source}\n`
        );
      }
    }

    if (report.diagnostics.length > 0) {
      context.stdout.write("\nDiagnostics:\n");
      for (const diagnostic of report.diagnostics) {
        const pluginId = diagnostic.pluginId ? ` (${diagnostic.pluginId})` : "";
        context.stdout.write(`- [${diagnostic.level}]${pluginId} ${diagnostic.message}\n`);
      }
    }

    return 0;
  }
};

type ParsedListArgs =
  | {
      ok: true;
      enabledOnly: boolean;
      verbose: boolean;
      includeBundled: boolean;
      json: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseListArgs(args: string[]): ParsedListArgs {
  let enabledOnly = false;
  let verbose = false;
  let includeBundled = false;
  let json = false;

  for (const token of args) {
    if (token === "--enabled") {
      enabledOnly = true;
      continue;
    }
    if (token === "--verbose") {
      verbose = true;
      continue;
    }
    if (token === "--all") {
      includeBundled = true;
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
    enabledOnly,
    verbose,
    includeBundled,
    json
  };
}
