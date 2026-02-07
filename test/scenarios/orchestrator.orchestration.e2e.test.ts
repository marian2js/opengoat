import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BaseProvider,
  OpenGoatService,
  ProviderRegistry,
  type ProviderExecutionResult,
  type ProviderInvokeOptions
} from "../../packages/core/src/index.js";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";
import { TestPathsProvider, createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("orchestrator e2e orchestration flow", () => {
  it("executes write/read artifact steps, delegates to an external agent, and finishes", async () => {
    const { service, provider, root } = await createHarness();

    const result = await service.runAgent("orchestrator", {
      message: "e2e:artifact-flow"
    });

    expect(result.code).toBe(0);
    expect(result.orchestration?.mode).toBe("ai-loop");
    expect(result.orchestration?.finalMessage).toBe("Artifact flow complete.");

    const planPath = path.join(root, "workspaces", "orchestrator", "coordination", "plan.md");
    expect(await readFile(planPath, "utf8")).toContain("Initial plan for delegated work.");

    const trace = JSON.parse(await readFile(result.tracePath, "utf8")) as {
      runId: string;
      orchestration?: {
        steps: Array<{
          plannerDecision: { action: { type: string } };
          agentCall?: { targetAgentId: string };
          artifactIO?: { readPath?: string; writePath?: string };
        }>;
      };
    };
    const steps = trace.orchestration?.steps ?? [];
    expect(steps.map((step) => step.plannerDecision.action.type)).toEqual([
      "write_workspace_file",
      "read_workspace_file",
      "delegate_to_agent",
      "finish"
    ]);

    const delegateStep = steps[2];
    expect(delegateStep?.agentCall?.targetAgentId).toBe("developer");
    expect(delegateStep?.artifactIO?.writePath).toContain(path.join("sessions", trace.runId, "step-03-to-developer.md"));
    expect(delegateStep?.artifactIO?.readPath).toContain(path.join("sessions", trace.runId, "step-03-from-developer.md"));

    const developerCalls = provider.calls.filter((call) => call.agentId === "developer");
    expect(developerCalls).toHaveLength(1);
    expect(developerCalls[0]?.message).not.toContain("Coordination file:");
    expect(developerCalls[0]?.message).toContain("Coordination artifacts are managed internally by the orchestrator.");
  });

  it("falls back to respond_user when orchestrator planner output is malformed", async () => {
    const { service } = await createHarness();
    const result = await service.runAgent("orchestrator", {
      message: "e2e:malformed-planner"
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("I could not complete orchestration due to planner output parsing issues.");
    expect(result.orchestration?.steps).toHaveLength(1);
    expect(result.orchestration?.steps[0]?.plannerDecision.action.type).toBe("respond_user");
  });

  it("stops after delegation safety limit is reached", async () => {
    const { service } = await createHarness();
    const result = await service.runAgent("orchestrator", {
      message: "e2e:delegation-limit"
    });

    expect(result.code).toBe(0);
    expect(result.orchestration?.steps).toHaveLength(8);
    expect(result.orchestration?.steps.every((step) => step.plannerDecision.action.type === "delegate_to_agent")).toBe(
      true
    );
    expect(result.orchestration?.finalMessage).toBe("Stopped orchestration after reaching delegation safety limit.");
  });
});

async function createHarness(): Promise<{
  service: OpenGoatService;
  provider: OrchestrationE2eProvider;
  root: string;
}> {
  const root = await createTempDir("opengoat-orchestrator-e2e-");
  roots.push(root);

  const provider = new OrchestrationE2eProvider();
  const registry = new ProviderRegistry();
  registry.register("orchestration-e2e", () => provider);

  const service = new OpenGoatService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    pathsProvider: new TestPathsProvider(root),
    providerRegistry: registry,
    nowIso: () => "2026-02-07T00:00:00.000Z"
  });

  await service.initialize();
  await service.createAgent("Developer");
  await service.setAgentProvider("orchestrator", "orchestration-e2e");
  await service.setAgentProvider("developer", "orchestration-e2e");

  return { service, provider, root };
}

class OrchestrationE2eProvider extends BaseProvider {
  public readonly calls: Array<{ agentId: string; message: string }> = [];

  public constructor() {
    super({
      id: "orchestration-e2e",
      displayName: "Orchestration E2E Provider",
      kind: "cli",
      capabilities: {
        agent: true,
        model: true,
        auth: false,
        passthrough: false
      }
    });
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);
    const agentId = options.agent ?? "unknown";
    this.calls.push({ agentId, message: options.message });

    if (agentId === "orchestrator") {
      const userMessage = extractUserMessage(options.message);
      if (userMessage.includes("e2e:malformed-planner")) {
        return {
          code: 0,
          stdout: "not-json",
          stderr: ""
        };
      }

      const step = resolvePlannerStep(options.message);
      if (userMessage.includes("e2e:artifact-flow")) {
        return {
          code: 0,
          stdout: `${JSON.stringify(this.artifactFlowAction(step), null, 2)}\n`,
          stderr: ""
        };
      }
      if (userMessage.includes("e2e:delegation-limit")) {
        return {
          code: 0,
          stdout: `${JSON.stringify(this.delegationLimitAction(step), null, 2)}\n`,
          stderr: ""
        };
      }

      return {
        code: 0,
        stdout: `${JSON.stringify(this.fallbackAction(), null, 2)}\n`,
        stderr: ""
      };
    }

    if (agentId === "developer") {
      return {
        code: 0,
        stdout: "Developer completed delegated work.\n",
        stderr: ""
      };
    }

    return {
      code: 0,
      stdout: `handled-by:${agentId}\n`,
      stderr: ""
    };
  }

  private artifactFlowAction(step: number): { rationale: string; action: Record<string, string> } {
    if (step === 1) {
      return {
        rationale: "Write a coordination artifact for the plan.",
        action: {
          type: "write_workspace_file",
          mode: "artifacts",
          path: "coordination/plan.md",
          content: "Initial plan for delegated work."
        }
      };
    }
    if (step === 2) {
      return {
        rationale: "Read the plan before delegation.",
        action: {
          type: "read_workspace_file",
          mode: "artifacts",
          path: "coordination/plan.md"
        }
      };
    }
    if (step === 3) {
      return {
        rationale: "Delegate implementation to specialist agent.",
        action: {
          type: "delegate_to_agent",
          mode: "hybrid",
          targetAgentId: "developer",
          message: "Implement the plan from coordination/plan.md.",
          expectedOutput: "Implementation summary."
        }
      };
    }

    return {
      rationale: "Flow complete.",
      action: {
        type: "finish",
        mode: "direct",
        message: "Artifact flow complete."
      }
    };
  }

  private delegationLimitAction(step: number): { rationale: string; action: Record<string, string> } {
    return {
      rationale: `Continue delegation step ${step}.`,
      action: {
        type: "delegate_to_agent",
        mode: "hybrid",
        targetAgentId: "developer",
        message: `Execute delegation limit test step ${step}.`,
        expectedOutput: "Short progress summary.",
        taskKey: "safety-limit-thread",
        sessionPolicy: "auto"
      }
    };
  }

  private fallbackAction(): { rationale: string; action: Record<string, string> } {
    return {
      rationale: "Complete unknown test flow.",
      action: {
        type: "finish",
        mode: "direct",
        message: "No-op flow completed."
      }
    };
  }
}

function extractUserMessage(prompt: string): string {
  const match = prompt.match(/User request:\n([\s\S]*?)\n\nShared notes:/);
  return (match?.[1] ?? prompt).trim();
}

function resolvePlannerStep(prompt: string): number {
  const match = prompt.match(/Step\s+(\d+)\//i);
  const value = Number.parseInt(match?.[1] ?? "1", 10);
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return value;
}
