import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BaseProvider,
  OpenGoatService,
  ProviderRegistry,
  type ProviderCreateAgentOptions,
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
  it("exposes home path and performs end-to-end bootstrap", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const service = createService(root);

    expect(service.getHomeDir()).toBe(root);

    const result = await service.initialize();
    expect(result.defaultAgent).toBe("orchestrator");

    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf-8")) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("orchestrator");
  });

  it("creates and lists agents through the facade", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const service = createService(root);
    await service.initialize();

    await service.createAgent("Research Analyst");

    const agents = await service.listAgents();
    expect(agents.map((agent) => agent.id)).toEqual(["orchestrator", "research-analyst"]);

    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf-8")) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("orchestrator");
  });

  it("gets and sets provider binding for an agent", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const service = createService(root);
    await service.initialize();

    const before = await service.getAgentProvider("orchestrator");
    expect(before.providerId).toBe("codex");

    const after = await service.setAgentProvider("orchestrator", "claude");
    expect(after.providerId).toBe("claude");
  });

  it("creates an external provider agent when requested during agent creation", async () => {
    const root = await createTempDir("opengoat-service-");
    roots.push(root);

    const provider = new AgentCreateProvider();
    const registry = new ProviderRegistry();
    registry.register("agent-create-provider", () => provider);
    const service = createService(root, registry);
    await service.initialize();

    const created = await service.createAgent("Research Analyst", {
      providerId: "agent-create-provider",
      createExternalAgent: true
    });

    expect(created.externalAgentCreation?.providerId).toBe("agent-create-provider");
    expect(created.externalAgentCreation?.code).toBe(0);
    expect(provider.createdAgents[0]?.agentId).toBe("research-analyst");
  });
});

function createService(root: string, registry?: ProviderRegistry): OpenGoatService {
  return new OpenGoatService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    pathsProvider: new TestPathsProvider(root),
    providerRegistry: registry,
    nowIso: () => "2026-02-06T00:00:00.000Z"
  });
}

class AgentCreateProvider extends BaseProvider {
  public readonly createdAgents: ProviderCreateAgentOptions[] = [];

  public constructor() {
    super({
      id: "agent-create-provider",
      displayName: "Agent Create Provider",
      kind: "cli",
      capabilities: {
        agent: true,
        model: true,
        auth: false,
        passthrough: false,
        agentCreate: true
      }
    });
  }

  public async invoke(_options: ProviderInvokeOptions) {
    return {
      code: 0,
      stdout: "ok\n",
      stderr: ""
    };
  }

  public override async createAgent(options: ProviderCreateAgentOptions) {
    this.createdAgents.push(options);
    return {
      code: 0,
      stdout: "created\n",
      stderr: ""
    };
  }
}
