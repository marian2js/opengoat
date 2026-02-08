import {
  BaseProvider,
  ProviderRegistry,
  type ProviderExecutionResult,
  type ProviderInvokeOptions
} from "../../providers/index.js";
import { OpenGoatService } from "../../opengoat/index.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { OpenGoatPathsProvider } from "../../ports/paths-provider.port.js";
import type { ScenarioRunResult, ScenarioSpec } from "../domain/scenario.js";

interface ScenarioRunnerServiceDeps {
  fileSystem: FileSystemPort;
  pathPort: PathPort;
  pathsProvider: OpenGoatPathsProvider;
  nowIso?: () => string;
}

export class ScenarioRunnerService {
  private readonly fileSystem: FileSystemPort;
  private readonly pathPort: PathPort;
  private readonly pathsProvider: OpenGoatPathsProvider;
  private readonly nowIso: () => string;

  public constructor(deps: ScenarioRunnerServiceDeps) {
    this.fileSystem = deps.fileSystem;
    this.pathPort = deps.pathPort;
    this.pathsProvider = deps.pathsProvider;
    this.nowIso = deps.nowIso ?? (() => new Date().toISOString());
  }

  public async runLive(service: OpenGoatService, scenario: ScenarioSpec): Promise<ScenarioRunResult> {
    await service.initialize();
    const result = await service.runAgent(scenario.entryAgentId ?? "orchestrator", {
      message: scenario.message
    });
    return this.evaluate("live", scenario, result);
  }

  public async runScripted(scenario: ScenarioSpec): Promise<ScenarioRunResult> {
    if (!scenario.scripted) {
      throw new Error("Scripted scenario mode requires a 'scripted' section.");
    }

    const registry = new ProviderRegistry();
    registry.register("scenario-scripted", () => new ScenarioScriptedProvider(scenario));

    const service = new OpenGoatService({
      fileSystem: this.fileSystem,
      pathPort: this.pathPort,
      pathsProvider: this.pathsProvider,
      providerRegistry: registry,
      nowIso: this.nowIso
    });

    await service.initialize();
    for (const agent of scenario.agents ?? []) {
      const created = await service.createAgent(agent.name);
      await service.setAgentProvider(created.agent.id, "scenario-scripted");
      await this.writeAgentManifest(created.agent.id, agent.name, agent.description);
    }
    await service.setAgentProvider("orchestrator", "scenario-scripted");

    const result = await service.runAgent(scenario.entryAgentId ?? "orchestrator", {
      message: scenario.message
    });
    return this.evaluate("scripted", scenario, result);
  }

  private evaluate(
    mode: "live" | "scripted",
    scenario: ScenarioSpec,
    result: Awaited<ReturnType<OpenGoatService["runAgent"]>>
  ): ScenarioRunResult {
    const assertions = scenario.assertions ?? {};
    const failures: string[] = [];

    if (assertions.mustSucceed !== false && result.code !== 0) {
      failures.push(`Expected success code 0, received ${result.code}.`);
    }

    const output = result.stdout.trim();
    for (const fragment of assertions.stdoutIncludes ?? []) {
      if (!output.includes(fragment)) {
        failures.push(`stdout missing required fragment: "${fragment}"`);
      }
    }

    const delegatedAgents = (result.orchestration?.steps ?? [])
      .map((step) => step.agentCall?.targetAgentId)
      .filter((value): value is string => Boolean(value));
    if (assertions.delegatedAgents) {
      const expected = assertions.delegatedAgents.join(",");
      const actual = delegatedAgents.join(",");
      if (expected !== actual) {
        failures.push(`delegated agents mismatch. expected=${expected} actual=${actual}`);
      }
    }

    const steps = result.orchestration?.steps.length ?? 0;
    if (typeof assertions.minSteps === "number" && steps < assertions.minSteps) {
      failures.push(`expected at least ${assertions.minSteps} steps, received ${steps}`);
    }
    if (typeof assertions.maxSteps === "number" && steps > assertions.maxSteps) {
      failures.push(`expected at most ${assertions.maxSteps} steps, received ${steps}`);
    }

    return {
      scenarioName: scenario.name,
      mode,
      success: failures.length === 0,
      failures,
      tracePath: result.tracePath,
      output,
      delegatedAgents,
      steps
    };
  }

  private async writeAgentManifest(agentId: string, name: string, description: string): Promise<void> {
    const paths = this.pathsProvider.getPaths();
    const manifestPath = this.pathPort.join(paths.workspacesDir, agentId, "AGENTS.md");
    const content =
      [
        "---",
        `id: ${agentId}`,
        `name: ${name}`,
        `description: ${description}`,
        "provider: scenario-scripted",
        "discoverable: true",
        "tags: [scenario, scripted]",
        "delegation:",
        "  canReceive: true",
        "  canDelegate: false",
        "priority: 70",
        "---",
        "",
        `# ${name}`,
        "",
        description
      ].join("\n") + "\n";
    await this.fileSystem.writeFile(manifestPath, content);
  }
}

class ScenarioScriptedProvider extends BaseProvider {
  private readonly scenario: ScenarioSpec;

  public constructor(scenario: ScenarioSpec) {
    super({
      id: "scenario-scripted",
      displayName: "Scenario Scripted Provider",
      kind: "http",
      capabilities: {
        agent: true,
        model: true,
        auth: false,
        passthrough: false
      }
    });
    this.scenario = scenario;
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);
    const agentId = options.agent ?? "unknown";

    const output = this.resolveOutput(agentId, options.message);
    options.onStdout?.(output);
    return {
      code: 0,
      stdout: output,
      stderr: ""
    };
  }

  private resolveOutput(agentId: string, message: string): string {
    if (agentId === "orchestrator") {
      return this.resolvePlannerOutput(message);
    }

    const reply = this.scenario.scripted?.agentReplies[agentId] ?? `handled-by:${agentId}`;
    return reply.endsWith("\n") ? reply : `${reply}\n`;
  }

  private resolvePlannerOutput(message: string): string {
    const actions = this.scenario.scripted?.orchestratorActions ?? [];
    const index = resolvePlannerStepIndex(message);
    const selected = actions[Math.min(index, Math.max(0, actions.length - 1))];
    if (!selected) {
      return JSON.stringify(
        {
          rationale: "No scripted action available.",
          action: {
            type: "finish",
            mode: "direct",
            message: "Scenario finished without scripted actions."
          }
        },
        null,
        2
      );
    }
    return `${JSON.stringify(selected, null, 2)}\n`;
  }
}

function resolvePlannerStepIndex(message: string): number {
  const match = message.match(/Step\s+(\d+)\//i);
  if (!match) {
    return 0;
  }

  const parsed = Number.parseInt(match[1] ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed <= 1) {
    return 0;
  }
  return parsed - 1;
}
