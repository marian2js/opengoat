import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BaseProvider,
  OpenGoatService,
  ProviderRegistry,
  type ProviderExecutionResult,
  type ProviderInvokeOptions
} from "../../src/index.js";
import { NodeFileSystem } from "../../src/platform/node/node-file-system.js";
import { NodePathPort } from "../../src/platform/node/node-path.port.js";
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

describe("orchestration task threads", () => {
  it("reuses provider session id when planner routes feedback to an existing task thread", async () => {
    const root = await createTempDir("opengoat-task-thread-");
    roots.push(root);

    const threadedProvider = new ThreadedScriptedProvider();
    const registry = new ProviderRegistry();
    registry.register("threaded-scripted", () => threadedProvider);

    const service = new OpenGoatService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      pathsProvider: new TestPathsProvider(root),
      providerRegistry: registry,
      nowIso: () => "2026-02-07T00:00:00.000Z"
    });

    await service.initialize();
    await service.createAgent("Developer");
    await service.createAgent("QA Agent");

    await service.setAgentProvider("orchestrator", "threaded-scripted");
    await service.setAgentProvider("developer", "threaded-scripted");
    await service.setAgentProvider("qa-agent", "threaded-scripted");

    await writeAgentManifest(root, "developer", "Developer", "Implements tasks.");
    await writeAgentManifest(root, "qa-agent", "QA Agent", "Validates changes.");

    const result = await service.runAgent("orchestrator", {
      message: "Implement feature and address QA feedback."
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Completed task thread orchestration");

    const developerCalls = threadedProvider.calls.filter((call) => call.agentId === "developer");
    expect(developerCalls).toHaveLength(2);
    expect(developerCalls[0]?.message).not.toContain("Coordination file:");
    expect(developerCalls[1]?.message).not.toContain("Coordination file:");
    expect(developerCalls[0]?.forceNewProviderSession).toBe(true);
    expect(developerCalls[1]?.providerSessionId).toBe("developer-thread-1");
    expect(developerCalls[1]?.forceNewProviderSession).toBe(false);

    const threads = result.orchestration?.taskThreads ?? [];
    const featureThread = threads.find((thread) => thread.taskKey === "task-feature-1");
    expect(featureThread?.agentId).toBe("developer");
    expect(featureThread?.providerSessionId).toBe("developer-thread-1");

    const trace = JSON.parse(await readFile(result.tracePath, "utf8")) as {
      orchestration?: {
        steps: Array<{
          agentCall?: {
            targetAgentId: string;
            taskKey?: string;
            providerSessionId?: string;
          };
        }>;
      };
    };
    const developerStepCalls = (trace.orchestration?.steps ?? [])
      .map((step) => step.agentCall)
      .filter((call): call is { targetAgentId: string; taskKey?: string; providerSessionId?: string } =>
        Boolean(call && call.targetAgentId === "developer")
      );
    expect(developerStepCalls[1]?.taskKey).toBe("task-feature-1");
    expect(developerStepCalls[1]?.providerSessionId).toBe("developer-thread-1");
  });
});

async function writeAgentManifest(root: string, agentId: string, name: string, description: string): Promise<void> {
  const content =
    [
      "---",
      `id: ${agentId}`,
      `name: ${name}`,
      `description: ${description}`,
      "provider: threaded-scripted",
      "tags: [specialized, delegated]",
      "delegation:",
      "  canReceive: true",
      "  canDelegate: false",
      "priority: 80",
      "---",
      "",
      `# ${name}`,
      "",
      description
    ].join("\n") + "\n";

  await writeFile(path.join(root, "workspaces", agentId, "AGENTS.md"), content, "utf8");
}

class ThreadedScriptedProvider extends BaseProvider {
  public readonly calls: Array<{
    agentId: string;
    message: string;
    sessionRef?: string;
    providerSessionId?: string;
    forceNewProviderSession?: boolean;
  }> = [];

  private developerThreadCount = 0;
  private qaThreadCount = 0;

  public constructor() {
    super({
      id: "threaded-scripted",
      displayName: "Threaded Scripted Provider",
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

    this.calls.push({
      agentId,
      message: options.message,
      sessionRef: options.sessionRef,
      providerSessionId: options.providerSessionId,
      forceNewProviderSession: options.forceNewProviderSession
    });

    if (agentId === "orchestrator") {
      const plannerStep = resolvePlannerStep(options.message);
      return {
        code: 0,
        stdout: `${JSON.stringify(this.plan(plannerStep), null, 2)}\n`,
        stderr: ""
      };
    }

    if (agentId === "developer") {
      const providerSessionId =
        options.providerSessionId || (options.forceNewProviderSession ? `developer-thread-${++this.developerThreadCount}` : undefined);
      return {
        code: 0,
        stdout: "Developer completed requested implementation step.\n",
        stderr: "",
        providerSessionId
      };
    }

    if (agentId === "qa-agent") {
      const providerSessionId =
        options.providerSessionId || (options.forceNewProviderSession ? `qa-thread-${++this.qaThreadCount}` : undefined);
      return {
        code: 0,
        stdout: "QA found one issue and requested a follow-up fix.\n",
        stderr: "",
        providerSessionId
      };
    }

    return {
      code: 0,
      stdout: `handled-by:${agentId}\n`,
      stderr: ""
    };
  }

  private plan(step: number): { rationale: string; action: Record<string, string> } {
    if (step === 1) {
      return {
        rationale: "Start implementation in a fresh task thread.",
        action: {
          type: "delegate_to_agent",
          mode: "hybrid",
          targetAgentId: "developer",
          message: "Implement the requested feature.",
          expectedOutput: "Summary of the implemented changes.",
          taskKey: "task-feature-1",
          sessionPolicy: "new"
        }
      };
    }

    if (step === 2) {
      return {
        rationale: "Ask QA to review implementation output.",
        action: {
          type: "delegate_to_agent",
          mode: "hybrid",
          targetAgentId: "qa-agent",
          message: "Review the implementation and report issues.",
          expectedOutput: "QA pass/fail summary.",
          taskKey: "task-feature-1-qa",
          sessionPolicy: "new"
        }
      };
    }

    if (step === 3) {
      return {
        rationale: "Route QA feedback back to the original developer task thread.",
        action: {
          type: "delegate_to_agent",
          mode: "hybrid",
          targetAgentId: "developer",
          message: "Apply QA feedback on the same feature thread.",
          expectedOutput: "Updated implementation summary.",
          taskKey: "task-feature-1",
          sessionPolicy: "reuse"
        }
      };
    }

    return {
      rationale: "Task completed.",
      action: {
        type: "finish",
        mode: "direct",
        message: "Completed task thread orchestration."
      }
    };
  }
}

function resolvePlannerStep(message: string): number {
  const match = message.match(/Step\s+(\d+)\//i);
  const value = Number.parseInt(match?.[1] ?? "1", 10);
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }
  return value;
}
