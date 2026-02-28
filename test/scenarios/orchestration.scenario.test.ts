import { afterEach, describe, expect, it } from "vitest";
import {
  BaseProvider,
  OpenGoatService,
  ProviderRegistry,
  type ProviderCreateAgentOptions,
  type ProviderDeleteAgentOptions,
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

describe("manager runtime scenarios", () => {
  it("runs single-agent manager runtime without internal delegation loop", async () => {
    const { service } = await createScenarioHarness();

    const result = await service.runAgent("goat", {
      message: "Build a new reporting dashboard with export support and verify it works."
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Manager acknowledged request");
  });

  it("falls back to goat when unknown entry agent is requested", async () => {
    const { service } = await createScenarioHarness();

    const result = await service.runAgent("missing-agent", { message: "Hello there" });

    expect(result.entryAgentId).toBe("goat");
  });
});

async function createScenarioHarness(): Promise<{ service: OpenGoatService; root: string }> {
  const root = await createTempDir("opengoat-scenario-");
  roots.push(root);

  const registry = new ProviderRegistry();
  registry.register("openclaw", () => new ScriptedProvider());

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

  return { service, root };
}

class ScriptedProvider extends BaseProvider {
  public constructor() {
    super({
      id: "openclaw",
      displayName: "Scripted Test Provider",
      kind: "http",
      capabilities: {
        agent: true,
        model: true,
        auth: false,
        passthrough: false,
        reportees: true,
        agentCreate: true,
        agentDelete: true
      }
    });
  }

  public async createAgent(_options: ProviderCreateAgentOptions): Promise<ProviderExecutionResult> {
    return {
      code: 0,
      stdout: "created\n",
      stderr: ""
    };
  }

  public async deleteAgent(_options: ProviderDeleteAgentOptions): Promise<ProviderExecutionResult> {
    return {
      code: 0,
      stdout: "deleted\n",
      stderr: ""
    };
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);
    const agentId = options.agent ?? "unknown";
    const output =
      agentId === "goat"
        ? `Manager acknowledged request: ${options.message.trim()}\n`
        : `handled-by:${agentId}\n`;

    options.onStdout?.(output);
    return {
      code: 0,
      stdout: output,
      stderr: ""
    };
  }
}
