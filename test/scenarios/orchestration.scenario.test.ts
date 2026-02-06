import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BaseProvider, OpenGoatService, ProviderRegistry, type ProviderExecutionResult, type ProviderInvokeOptions } from "../../src/index.js";
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
  it("routes research scenario to research agent and persists trace", async () => {
    const fixture = await readFixture("research-routing.json");
    const { service } = await createScenarioHarness();

    const decision = await service.routeMessage("orchestrator", fixture.userMessage);
    expect(decision.targetAgentId).toBe(fixture.expectedTargetAgentId);
    for (const fragment of fixture.expectedRewriteIncludes) {
      expect(decision.rewrittenMessage).toContain(fragment);
    }

    const result = await service.runAgent("orchestrator", { message: fixture.userMessage });
    expect(result.agentId).toBe(fixture.expectedTargetAgentId);
    expect(result.stdout).toContain(`handled-by:${fixture.expectedTargetAgentId}`);

    const trace = JSON.parse(await readFile(result.tracePath, "utf8")) as {
      entryAgentId: string;
      routing: { targetAgentId: string };
      execution: { agentId: string };
    };
    expect(trace.entryAgentId).toBe("orchestrator");
    expect(trace.routing.targetAgentId).toBe(fixture.expectedTargetAgentId);
    expect(trace.execution.agentId).toBe(fixture.expectedTargetAgentId);
  });

  it("routes writing scenario to writer agent", async () => {
    const fixture = await readFixture("writer-routing.json");
    const { service } = await createScenarioHarness();

    const decision = await service.routeMessage("orchestrator", fixture.userMessage);
    expect(decision.targetAgentId).toBe(fixture.expectedTargetAgentId);

    const result = await service.runAgent("orchestrator", { message: fixture.userMessage });
    expect(result.agentId).toBe(fixture.expectedTargetAgentId);
    expect(result.stdout).toContain(`handled-by:${fixture.expectedTargetAgentId}`);
  });

  it("falls back to orchestrator when unknown entry agent is requested", async () => {
    const { service } = await createScenarioHarness();

    const decision = await service.routeMessage("missing-agent", "hi");
    expect(decision.entryAgentId).toBe("orchestrator");

    const result = await service.runAgent("missing-agent", { message: "hi" });
    expect(result.entryAgentId).toBe("orchestrator");
    expect(result.agentId).toBe("orchestrator");
    expect(result.stdout).toContain("handled-by:orchestrator");
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
  await service.createAgent("Research Agent");
  await service.createAgent("Writer Agent");

  await service.setAgentProvider("orchestrator", "scripted");
  await service.setAgentProvider("research-agent", "scripted");
  await service.setAgentProvider("writer-agent", "scripted");

  await writeAgentManifest(root, "research-agent", {
    name: "Research Agent",
    description: "Performs technical research and produces references.",
    tags: ["research", "docs", "references"],
    priority: 85
  });
  await writeAgentManifest(root, "writer-agent", {
    name: "Writer Agent",
    description: "Writes clear and polished user-facing communication.",
    tags: ["writing", "content", "email"],
    priority: 75
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

async function readFixture(fileName: string): Promise<{
  name: string;
  userMessage: string;
  expectedTargetAgentId: string;
  expectedRewriteIncludes: string[];
}> {
  const fixturePath = path.join(process.cwd(), "test", "scenarios", "fixtures", fileName);
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw) as {
    name: string;
    userMessage: string;
    expectedTargetAgentId: string;
    expectedRewriteIncludes: string[];
  };
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
    const output = `handled-by:${agentId}\n`;
    options.onStdout?.(output);
    return {
      code: 0,
      stdout: output,
      stderr: ""
    };
  }
}
