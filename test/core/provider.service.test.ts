import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { InvalidProviderConfigError, ProviderService } from "../../packages/core/src/core/providers/index.js";
import { ProviderRegistry } from "../../packages/core/src/core/providers/registry.js";
import type {
  Provider,
  ProviderCreateAgentOptions,
  ProviderDeleteAgentOptions,
  ProviderExecutionResult,
  ProviderInvokeOptions
} from "../../packages/core/src/core/providers/types.js";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("ProviderService (OpenClaw runtime)", () => {
  it("lists only openclaw provider", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);
    const { fileSystem } = await createPaths(root);
    const registry = createRegistry(new FakeOpenClawProvider());
    const service = createProviderService(fileSystem, registry);

    const providers = await service.listProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]?.id).toBe("openclaw");
  });

  it("invokes agent without overriding OpenClaw-managed skills context", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);
    const { paths, fileSystem } = await createPaths(root);
    await seedAgent(fileSystem, paths, "ceo");

    const provider = new FakeOpenClawProvider();
    const service = createProviderService(fileSystem, createRegistry(provider));

    const result = await service.invokeAgent(paths, "ceo", { message: "hello" });

    expect(result.providerId).toBe("openclaw");
    expect(provider.lastInvoke?.cwd).toBeUndefined();
    expect(provider.lastInvoke?.systemPrompt).toBeUndefined();
    expect(provider.lastInvoke?.message).toBe("hello");
    expect(provider.lastInvoke?.agent).toBe("ceo");
  });

  it("stores and resolves external gateway config", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);
    const { paths, fileSystem } = await createPaths(root);
    const service = createProviderService(fileSystem, createRegistry(new FakeOpenClawProvider()));

    await service.setOpenClawGatewayConfig(paths, {
      mode: "external",
      gatewayUrl: "ws://remote-host:18789",
      gatewayToken: "secret-token"
    });

    const resolved = await service.getOpenClawGatewayConfig(paths);
    expect(resolved).toEqual({
      mode: "external",
      gatewayUrl: "ws://remote-host:18789",
      gatewayToken: "secret-token",
      command: "openclaw"
    });

    const config = await service.getProviderConfig(paths, "openclaw");
    expect(config?.env.OPENCLAW_ARGUMENTS).toContain("--remote ws://remote-host:18789");
    expect(config?.env.OPENCLAW_ARGUMENTS).toContain("--token secret-token");

    await service.setOpenClawGatewayConfig(paths, { mode: "local" });
    const local = await service.getOpenClawGatewayConfig(paths);
    expect(local.mode).toBe("local");
  });

  it("resolves gateway config from effective runtime env overrides", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);
    const { paths, fileSystem } = await createPaths(root);
    const service = createProviderService(fileSystem, createRegistry(new FakeOpenClawProvider()));

    await service.setProviderConfig(paths, "openclaw", {
      OPENGOAT_OPENCLAW_GATEWAY_MODE: "local"
    });

    const resolved = await service.getOpenClawGatewayConfig(paths, {
      OPENCLAW_ARGUMENTS: "--remote ws://env-host:18789 --token env-secret"
    });

    expect(resolved).toEqual({
      mode: "external",
      gatewayUrl: "ws://env-host:18789",
      gatewayToken: "env-secret",
      command: "openclaw"
    });
  });

  it("throws InvalidProviderConfigError for invalid stored config", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);
    const { paths, fileSystem } = await createPaths(root);
    await fileSystem.ensureDir(path.join(paths.providersDir, "openclaw"));
    await fileSystem.writeFile(path.join(paths.providersDir, "openclaw", "config.json"), "{ bad json");

    const service = createProviderService(fileSystem, createRegistry(new FakeOpenClawProvider()));
    await expect(service.getProviderConfig(paths, "openclaw")).rejects.toBeInstanceOf(InvalidProviderConfigError);
  });

  it("syncs agent lifecycle through create/delete provider hooks", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);
    const { paths, fileSystem } = await createPaths(root);
    const provider = new FakeOpenClawProvider();
    const service = createProviderService(fileSystem, createRegistry(provider));

    await service.createProviderAgent(paths, "developer", {
      displayName: "Developer",
      workspaceDir: "/tmp/workspaces/developer",
      internalConfigDir: "/tmp/agents/developer"
    });
    await service.deleteProviderAgent(paths, "developer", {});

    expect(provider.lastCreate?.agentId).toBe("developer");
    expect(provider.lastDelete?.agentId).toBe("developer");
  });
});

function createRegistry(provider: Provider): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register("openclaw", () => provider, {
    id: "openclaw",
    create: () => provider,
    onboarding: {
      env: []
    }
  });
  return registry;
}

function createProviderService(fileSystem: NodeFileSystem, registry: ProviderRegistry): ProviderService {
  const pathPort = new NodePathPort();
  return new ProviderService({
    fileSystem,
    pathPort,
    providerRegistry: registry,
    nowIso: () => "2026-02-06T00:00:00.000Z"
  });
}

async function createPaths(root: string): Promise<{ paths: OpenGoatPaths; fileSystem: NodeFileSystem }> {
  const fileSystem = new NodeFileSystem();
  const paths: OpenGoatPaths = {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
    agentsDir: path.join(root, "agents"),
    skillsDir: path.join(root, "skills"),
    providersDir: path.join(root, "providers"),
    sessionsDir: path.join(root, "sessions"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json")
  };

  await fileSystem.ensureDir(paths.homeDir);
  await fileSystem.ensureDir(paths.workspacesDir);
  await fileSystem.ensureDir(paths.agentsDir);
  await fileSystem.ensureDir(paths.skillsDir);
  await fileSystem.ensureDir(paths.providersDir);
  await fileSystem.ensureDir(paths.sessionsDir);
  await fileSystem.ensureDir(paths.runsDir);

  return { paths, fileSystem };
}

async function seedAgent(fileSystem: NodeFileSystem, paths: OpenGoatPaths, agentId: string): Promise<void> {
  await fileSystem.ensureDir(path.join(paths.agentsDir, agentId));
  await fileSystem.writeFile(
    path.join(paths.agentsDir, agentId, "config.json"),
    JSON.stringify(
      {
        displayName: "CEO",
        prompt: {
          bootstrapFiles: ["AGENTS.md"]
        },
        runtime: {
          skills: {
            enabled: true,
            includeManaged: true,
            assigned: []
          }
        }
      },
      null,
      2
    )
  );
}

class FakeOpenClawProvider implements Provider {
  public readonly id = "openclaw";
  public readonly displayName = "OpenClaw";
  public readonly kind = "cli" as const;
  public readonly capabilities = {
    agent: true,
    model: true,
    auth: true,
    passthrough: true,
    agentCreate: true,
    agentDelete: true
  };

  public lastInvoke?: ProviderInvokeOptions;
  public lastCreate?: ProviderCreateAgentOptions;
  public lastDelete?: ProviderDeleteAgentOptions;

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.lastInvoke = options;
    return {
      code: 0,
      stdout: "ok\n",
      stderr: ""
    };
  }

  public async invokeAuth(): Promise<ProviderExecutionResult> {
    return {
      code: 0,
      stdout: "auth\n",
      stderr: ""
    };
  }

  public async createAgent(options: ProviderCreateAgentOptions): Promise<ProviderExecutionResult> {
    this.lastCreate = options;
    return {
      code: 0,
      stdout: "created\n",
      stderr: ""
    };
  }

  public async deleteAgent(options: ProviderDeleteAgentOptions): Promise<ProviderExecutionResult> {
    this.lastDelete = options;
    return {
      code: 0,
      stdout: "deleted\n",
      stderr: ""
    };
  }
}
