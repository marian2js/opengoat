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

describe("orchestration scenarios", () => {
  it("runs an AI-driven multi-agent chain (PM -> Dev -> QA) without hardcoded workflow steps", async () => {
    const { service } = await createScenarioHarness();
    const userMessage = "Build a new reporting dashboard with export support and verify it works.";

    const result = await service.runAgent("orchestrator", { message: userMessage });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Feature delivered");
    expect(result.orchestration?.mode).toBe("ai-loop");
    expect(result.orchestration?.steps.length).toBeGreaterThanOrEqual(4);

    const delegatedTargets = (result.orchestration?.steps ?? [])
      .map((step) => step.agentCall?.targetAgentId)
      .filter((value): value is string => Boolean(value));
    expect(delegatedTargets).toEqual(["product-manager", "developer", "qa-agent"]);

    const trace = JSON.parse(await readFile(result.tracePath, "utf8")) as {
      orchestration?: {
        mode: string;
        steps: Array<{ plannerDecision: { action: { type: string } } }>;
        sessionGraph: { nodes: Array<{ agentId: string }>; edges: Array<{ fromAgentId: string; toAgentId: string }> };
      };
    };
    expect(trace.orchestration?.mode).toBe("ai-loop");
    expect(trace.orchestration?.steps.some((step) => step.plannerDecision.action.type === "delegate_to_agent")).toBe(
      true
    );
    expect(trace.orchestration?.sessionGraph.nodes.map((node) => node.agentId)).toEqual(
      expect.arrayContaining(["orchestrator", "product-manager", "developer", "qa-agent"])
    );
  });

  it("still falls back to orchestrator when unknown entry agent is requested", async () => {
    const { service } = await createScenarioHarness();
    const result = await service.runAgent("missing-agent", { message: "Hello there" });

    expect(result.entryAgentId).toBe("orchestrator");
    expect(result.orchestration?.mode).toBe("ai-loop");
  });
});

async function createScenarioHarness(): Promise<{ service: OpenGoatService; root: string }> {
  const root = await createTempDir("opengoat-scenario-");
  roots.push(root);

  const registry = new ProviderRegistry();
  registry.register("scripted", () => new ScriptedProvider());

  const service = new OpenGoatService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    pathsProvider: new TestPathsProvider(root),
    providerRegistry: registry,
    nowIso: () => "2026-02-06T00:00:00.000Z"
  });

  await service.initialize();
  await service.createAgent("Product Manager");
  await service.createAgent("Developer");
  await service.createAgent("QA Agent");

  await service.setAgentProvider("orchestrator", "scripted");
  await service.setAgentProvider("product-manager", "scripted");
  await service.setAgentProvider("developer", "scripted");
  await service.setAgentProvider("qa-agent", "scripted");

  await writeAgentManifest(root, "product-manager", {
    name: "Product Manager",
    description: "Creates plans and clarifies scope.",
    tags: ["product", "planning", "scope"],
    priority: 80
  });
  await writeAgentManifest(root, "developer", {
    name: "Developer",
    description: "Implements changes in code.",
    tags: ["implementation", "coding", "cursor"],
    priority: 80
  });
  await writeAgentManifest(root, "qa-agent", {
    name: "QA Agent",
    description: "Validates implementation and confirms outcomes.",
    tags: ["qa", "testing", "verification"],
    priority: 80
  });

  return { service, root };
}

async function writeAgentManifest(
  root: string,
  agentId: string,
  metadata: { name: string; description: string; tags: string[]; priority: number }
): Promise<void> {
  const content =
    [
      "---",
      `id: ${agentId}`,
      `name: ${metadata.name}`,
      `description: ${metadata.description}`,
      "provider: scripted",
      `tags: [${metadata.tags.join(", ")}]`,
      "delegation:",
      "  canReceive: true",
      "  canDelegate: false",
      `priority: ${metadata.priority}`,
      "---",
      "",
      `# ${metadata.name}`,
      "",
      metadata.description
    ].join("\n") + "\n";

  await writeFile(path.join(root, "workspaces", agentId, "AGENTS.md"), content, "utf8");
}

class ScriptedProvider extends BaseProvider {
  public constructor() {
    super({
      id: "scripted",
      displayName: "Scripted Test Provider",
      kind: "http",
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
    const output = this.respond(agentId, options.message);
    options.onStdout?.(output);
    return {
      code: 0,
      stdout: output,
      stderr: ""
    };
  }

  private respond(agentId: string, message: string): string {
    if (agentId === "orchestrator") {
      return `${JSON.stringify(this.planAction(message), null, 2)}\n`;
    }

    if (agentId === "product-manager") {
      return "PLAN: Scope accepted. Build dashboard UI, add export backend, and define QA acceptance checks.\n";
    }
    if (agentId === "developer") {
      return "IMPLEMENTED: Dashboard + export endpoint implemented with migration and docs.\n";
    }
    if (agentId === "qa-agent") {
      return "VERIFIED: All expected changes are present and tests pass.\n";
    }

    return `handled-by:${agentId}\n`;
  }

  private planAction(message: string): {
    rationale: string;
    action: Record<string, string>;
  } {
    const normalized = message.toLowerCase();
    if (!normalized.includes("delegated to product-manager")) {
      return {
        rationale: "Start with product planning.",
        action: {
          type: "delegate_to_agent",
          mode: "hybrid",
          targetAgentId: "product-manager",
          message: "Create the product plan for this request.",
          expectedOutput: "A concrete implementation plan."
        }
      };
    }

    if (!normalized.includes("delegated to developer")) {
      return {
        rationale: "Move to implementation.",
        action: {
          type: "delegate_to_agent",
          mode: "hybrid",
          targetAgentId: "developer",
          message: "Implement the plan from product manager.",
          expectedOutput: "Summary of implemented code changes."
        }
      };
    }

    if (!normalized.includes("delegated to qa-agent")) {
      return {
        rationale: "Verify delivery with QA.",
        action: {
          type: "delegate_to_agent",
          mode: "hybrid",
          targetAgentId: "qa-agent",
          message: "Validate implementation against expected outcomes.",
          expectedOutput: "Pass/fail verification summary."
        }
      };
    }

    return {
      rationale: "Chain complete, respond to user.",
      action: {
        type: "finish",
        mode: "direct",
        message:
          "Feature delivered: Product plan completed, developer implementation finished, and QA confirmed expected changes."
      }
    };
  }
}
