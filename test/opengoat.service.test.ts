import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BaseProvider,
  OpenGoatService,
  ProviderRegistry,
  type ProviderCreateAgentOptions,
  type ProviderDeleteAgentOptions,
  type ProviderExecutionResult,
  type ProviderInvokeOptions
} from "../packages/core/src/index.js";
import { NodeFileSystem } from "../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../packages/core/src/platform/node/node-path.port.js";
import { TestPathsProvider, createTempDir, removeTempDir } from "./helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("OpenGoatService", () => {
  it("exposes home path and bootstraps goat as default agent", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const service = createService(root).service;
    expect(service.getHomeDir()).toBe(root);

    const result = await service.initialize();
    expect(result.defaultAgent).toBe("goat");

    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf-8")) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("goat");
  });

  it("creates and lists agents through the facade", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();

    const created = await service.createAgent("Research Analyst", {
      type: "individual",
      reportsTo: "goat",
      skills: ["research"]
    });

    expect(created.agent.id).toBe("research-analyst");
    expect(created.runtimeSync?.runtimeId).toBe("openclaw");
    expect(created.runtimeSync?.code).toBe(0);

    const agents = await service.listAgents();
    expect(agents.map((agent) => agent.id)).toEqual(["goat", "research-analyst"]);
  });

  it("still syncs OpenClaw when the local agent already exists", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();

    await service.createAgent("Research Analyst");
    const second = await service.createAgent("Research Analyst");

    expect(second.alreadyExisted).toBe(true);
    expect(second.runtimeSync?.runtimeId).toBe("openclaw");
    expect(provider.createdAgents.filter((entry) => entry.agentId === "research-analyst")).toHaveLength(2);
  });

  it("does not delete local files when sync fails for an already existing agent", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();
    await service.createAgent("Research Analyst");
    provider.failCreate = true;

    await expect(service.createAgent("Research Analyst")).rejects.toThrow("OpenClaw agent creation failed");

    const agents = await service.listAgents();
    expect(agents.map((agent) => agent.id)).toEqual(["goat", "research-analyst"]);
  });

  it("treats OpenClaw already-exists response as successful sync", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();
    await service.createAgent("Research Analyst");
    provider.createAlreadyExists = true;

    const repeated = await service.createAgent("Research Analyst");
    expect(repeated.alreadyExisted).toBe(true);
    expect(repeated.runtimeSync?.runtimeId).toBe("openclaw");
  });

  it("rolls back local files when OpenClaw create fails", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const fakeProvider = new FakeOpenClawProvider();
    fakeProvider.failCreate = true;
    const { service } = createService(root, fakeProvider);
    await service.initialize();

    await expect(service.createAgent("Broken Agent")).rejects.toThrow("OpenClaw agent creation failed");

    const agents = await service.listAgents();
    expect(agents.map((agent) => agent.id)).toEqual(["goat"]);
  });

  it("deletes local and OpenClaw runtime agents", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();
    await service.createAgent("Research Analyst");

    const deleted = await service.deleteAgent("research-analyst");

    expect(deleted.existed).toBe(true);
    expect(deleted.runtimeSync?.runtimeId).toBe("openclaw");
    expect(provider.deletedAgents.map((entry) => entry.agentId)).toContain("research-analyst");
  });

  it("supports force delete when OpenClaw delete fails", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const fakeProvider = new FakeOpenClawProvider();
    fakeProvider.failDelete = true;
    const { service } = createService(root, fakeProvider);
    await service.initialize();
    await service.createAgent("Research Analyst");

    await expect(service.deleteAgent("research-analyst")).rejects.toThrow("OpenClaw agent deletion failed");

    const forced = await service.deleteAgent("research-analyst", { force: true });
    expect(forced.existed).toBe(true);
  });

  it("syncs runtime defaults with goat and cleans legacy orchestrator", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service, provider } = createService(root);
    await service.initialize();

    const result = await service.syncRuntimeDefaults();

    expect(result.goatSynced).toBe(true);
    expect(result.legacyOrchestratorRemoved).toBe(true);
    expect(provider.createdAgents.some((entry) => entry.agentId === "goat")).toBe(true);
    expect(provider.deletedAgents.some((entry) => entry.agentId === "orchestrator")).toBe(true);
  });

  it("updates who an agent reports to", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const { service } = createService(root);
    await service.initialize();
    await service.createAgent("CTO", { type: "manager", reportsTo: "goat" });
    await service.createAgent("Engineer");

    const updated = await service.setAgentManager("engineer", "cto");
    expect(updated.previousReportsTo).toBe("goat");
    expect(updated.reportsTo).toBe("cto");
  });
});

function createService(
  root: string,
  provider: FakeOpenClawProvider = new FakeOpenClawProvider()
): { service: OpenGoatService; provider: FakeOpenClawProvider } {
  const registry = new ProviderRegistry();
  registry.register("openclaw", () => provider);

  const service = new OpenGoatService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    pathsProvider: new TestPathsProvider(root),
    providerRegistry: registry,
    nowIso: () => "2026-02-06T00:00:00.000Z"
  });
  return {
    service,
    provider
  };
}

class FakeOpenClawProvider extends BaseProvider {
  public readonly createdAgents: ProviderCreateAgentOptions[] = [];
  public readonly deletedAgents: ProviderDeleteAgentOptions[] = [];
  public failCreate = false;
  public createAlreadyExists = false;
  public failDelete = false;

  public constructor() {
    super({
      id: "openclaw",
      displayName: "OpenClaw",
      kind: "cli",
      capabilities: {
        agent: true,
        model: true,
        auth: true,
        passthrough: true,
        agentCreate: true,
        agentDelete: true
      }
    });
  }

  public async invoke(_options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    return {
      code: 0,
      stdout: "ok\n",
      stderr: ""
    };
  }

  public override async createAgent(options: ProviderCreateAgentOptions): Promise<ProviderExecutionResult> {
    this.createdAgents.push(options);
    if (this.failCreate) {
      return {
        code: 1,
        stdout: "",
        stderr: "create failed"
      };
    }
    if (this.createAlreadyExists) {
      return {
        code: 1,
        stdout: "",
        stderr: "agent already exists"
      };
    }
    return {
      code: 0,
      stdout: "created\n",
      stderr: ""
    };
  }

  public override async deleteAgent(options: ProviderDeleteAgentOptions): Promise<ProviderExecutionResult> {
    this.deletedAgents.push(options);
    if (this.failDelete) {
      return {
        code: 1,
        stdout: "",
        stderr: "delete failed"
      };
    }
    return {
      code: 0,
      stdout: "deleted\n",
      stderr: ""
    };
  }
}
