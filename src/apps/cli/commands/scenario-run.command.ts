import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ScenarioSpec } from "../../../core/scenarios/index.js";
import { ScenarioRunnerService } from "../../../core/scenarios/index.js";
import { NodeFileSystem } from "../../../platform/node/node-file-system.js";
import { NodeOpenGoatPathsProvider, NodePathPort } from "../../../platform/node/node-path.port.js";
import type { CliCommand } from "../framework/command.js";

export const scenarioRunCommand: CliCommand = {
  path: ["scenario", "run"],
  description: "Run a scenario in live or scripted mode.",
  async run(args, context): Promise<number> {
    const parsed = parseArgs(args);
    if (!parsed.ok) {
      context.stderr.write(`${parsed.error}\n`);
      printHelp(context.stderr);
      return 1;
    }

    if (parsed.help) {
      printHelp(context.stdout);
      return 0;
    }

    const scenario = await readScenario(parsed.filePath);
    const runner = new ScenarioRunnerService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      pathsProvider: new NodeOpenGoatPathsProvider()
    });

    const report =
      parsed.mode === "live" ? await runner.runLive(context.service, scenario) : await runner.runScripted(scenario);

    if (parsed.json) {
      context.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      context.stdout.write(`Scenario: ${report.scenarioName}\n`);
      context.stdout.write(`Mode: ${report.mode}\n`);
      context.stdout.write(`Success: ${report.success}\n`);
      context.stdout.write(`Steps: ${report.steps}\n`);
      context.stdout.write(`Delegated agents: ${report.delegatedAgents.join(", ") || "(none)"}\n`);
      context.stdout.write(`Trace: ${report.tracePath}\n`);
      context.stdout.write(`Output:\n${report.output}\n`);
      if (report.failures.length > 0) {
        context.stdout.write("Failures:\n");
        for (const failure of report.failures) {
          context.stdout.write(`- ${failure}\n`);
        }
      }
    }

    return report.success ? 0 : 1;
  }
};

type Parsed =
  | {
      ok: true;
      help: boolean;
      filePath: string;
      mode: "live" | "scripted";
      json: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function parseArgs(args: string[]): Parsed {
  let help = false;
  let filePath: string | undefined;
  let mode: "live" | "scripted" = "live";
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--help" || token === "-h" || token === "help") {
      help = true;
      continue;
    }
    if (token === "--json") {
      json = true;
      continue;
    }
    if (token === "--file") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { ok: false, error: "Missing value for --file." };
      }
      filePath = value;
      index += 1;
      continue;
    }
    if (token === "--mode") {
      const value = args[index + 1]?.trim().toLowerCase();
      if (!value) {
        return { ok: false, error: "Missing value for --mode." };
      }
      if (value !== "live" && value !== "scripted") {
        return { ok: false, error: "Invalid --mode. Use live or scripted." };
      }
      mode = value;
      index += 1;
      continue;
    }

    return { ok: false, error: `Unknown option: ${token}` };
  }

  if (!help && !filePath) {
    return { ok: false, error: "--file is required." };
  }

  return {
    ok: true,
    help,
    filePath: filePath ? path.resolve(filePath) : "",
    mode,
    json
  };
}

async function readScenario(filePath: string): Promise<ScenarioSpec> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as ScenarioSpec;
}

function printHelp(output: NodeJS.WritableStream): void {
  output.write("Usage:\n");
  output.write("  opengoat scenario run --file <scenario.json> [--mode live|scripted] [--json]\n");
  output.write("\n");
  output.write("Notes:\n");
  output.write("  - live mode uses your configured providers and agents.\n");
  output.write("  - scripted mode runs deterministic orchestration from scenario.scripted.\n");
}
