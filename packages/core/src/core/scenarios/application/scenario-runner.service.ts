import { OpenGoatService } from "../../opengoat/index.js";
import type { FileSystemPort } from "../../ports/file-system.port.js";
import type { PathPort } from "../../ports/path.port.js";
import type { OpenGoatPathsProvider } from "../../ports/paths-provider.port.js";
import {
  BaseProvider,
  ProviderRegistry,
  type ProviderCreateAgentOptions,
  type ProviderDeleteAgentOptions,
  type ProviderExecutionResult,
  type ProviderInvokeOptions,
} from "../../providers/index.js";
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

  public async runLive(
    service: OpenGoatService,
    scenario: ScenarioSpec,
  ): Promise<ScenarioRunResult> {
    await service.initialize();
    const result = await service.runAgent(scenario.entryAgentId ?? "goat", {
      message: scenario.message,
    });
    return this.evaluate("live", scenario, result);
  }

  public async runScripted(scenario: ScenarioSpec): Promise<ScenarioRunResult> {
    if (!scenario.scripted) {
      throw new Error("Scripted scenario mode requires a 'scripted' section.");
    }

    const registry = new ProviderRegistry();
    registry.register("openclaw", () => new ScenarioScriptedProvider(scenario));

    const service = new OpenGoatService({
      fileSystem: this.fileSystem,
      pathPort: this.pathPort,
      pathsProvider: this.pathsProvider,
      providerRegistry: registry,
      nowIso: this.nowIso,
    });

    await service.initialize();
    for (const agent of scenario.agents ?? []) {
      await service.createAgent(agent.name);
    }

    const result = await service.runAgent(scenario.entryAgentId ?? "goat", {
      message: scenario.message,
    });
    return this.evaluate("scripted", scenario, result);
  }

  private evaluate(
    mode: "live" | "scripted",
    scenario: ScenarioSpec,
    result: Awaited<ReturnType<OpenGoatService["runAgent"]>>,
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

    return {
      scenarioName: scenario.name,
      mode,
      success: failures.length === 0,
      failures,
      tracePath: result.tracePath,
      output,
    };
  }

}

class ScenarioScriptedProvider extends BaseProvider {
  private readonly scenario: ScenarioSpec;

  public constructor(scenario: ScenarioSpec) {
    super({
      id: "openclaw",
      displayName: "Scenario Scripted Provider",
      kind: "http",
      capabilities: {
        agent: true,
        model: true,
        auth: false,
        passthrough: false,
        reportees: true,
        agentCreate: true,
        agentDelete: true,
      },
    });
    this.scenario = scenario;
  }

  public async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);
    const agentId = options.agent ?? "unknown";

    const output = this.resolveOutput(agentId, options.message);
    options.onStdout?.(output);
    return {
      code: 0,
      stdout: output,
      stderr: "",
    };
  }

  public override async createAgent(
    _options: ProviderCreateAgentOptions,
  ): Promise<ProviderExecutionResult> {
    return {
      code: 0,
      stdout: "",
      stderr: "",
    };
  }

  public override async deleteAgent(
    _options: ProviderDeleteAgentOptions,
  ): Promise<ProviderExecutionResult> {
    return {
      code: 0,
      stdout: "",
      stderr: "",
    };
  }

  private resolveOutput(agentId: string, message: string): string {
    const reply =
      this.scenario.scripted?.agentReplies[agentId] ??
      this.scenario.scripted?.agentReplies.goat ??
      this.scenario.scripted?.agentReplies.ceo ??
      `handled-by:${agentId}`;
    return reply.endsWith("\n") ? reply : `${reply}\n`;
  }
}
