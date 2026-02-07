import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceContextService } from "../../src/core/agents/index.js";
import type { OpenGoatPaths } from "../../src/core/domain/opengoat-paths.js";
import {
  InvalidAgentConfigError,
  InvalidProviderConfigError,
  ProviderService
} from "../../src/core/providers/index.js";
import { SkillService } from "../../src/core/skills/index.js";
import { ProviderRegistry } from "../../src/core/providers/registry.js";
import type { Provider, ProviderInvokeOptions } from "../../src/core/providers/types.js";
import { NodeFileSystem } from "../../src/platform/node/node-file-system.js";
import { NodePathPort } from "../../src/platform/node/node-path.port.js";
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

describe("ProviderService", () => {
  it("injects workspace context into system prompt and defaults cwd to workspace", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await seedAgent(fileSystem, paths, {
      providerId: "fake",
      bootstrapFiles: ["AGENTS.md", "MISSING.md"]
    });

    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "fake",
      capabilities: { agent: true, model: true, auth: false, passthrough: false },
      onInvoke: (options) => captured.push(options)
    });

    const registry = new ProviderRegistry();
    registry.register("fake", () => provider);

    const service = createProviderService(fileSystem, registry);
    const result = await service.invokeAgent(paths, "orchestrator", { message: "hello" });

    expect(result.providerId).toBe("fake");
    expect(captured[0]?.cwd).toBe(path.join(paths.workspacesDir, "orchestrator"));
    expect(captured[0]?.agent).toBe("orchestrator");
    expect(captured[0]?.message).toBe("hello");
    expect(captured[0]?.systemPrompt).toContain("# Project Context");
    expect(captured[0]?.systemPrompt).toContain("## AGENTS.md");
    expect(captured[0]?.systemPrompt).toContain("## Skills");
    expect(captured[0]?.systemPrompt).toContain("[MISSING] Expected at:");
  });

  it("does not force agent option for providers without agent capability", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await seedAgent(fileSystem, paths, {
      providerId: "no-agent",
      bootstrapFiles: ["AGENTS.md"]
    });
    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "no-agent",
      capabilities: { agent: false, model: true, auth: false, passthrough: false },
      onInvoke: (options) => captured.push(options)
    });

    const registry = new ProviderRegistry();
    registry.register("no-agent", () => provider);

    const service = createProviderService(fileSystem, registry);
    await service.invokeAgent(paths, "orchestrator", { message: "hello" });

    expect(captured[0]?.agent).toBeUndefined();
  });

  it("persists provider config and injects it into provider invoke env", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await seedAgent(fileSystem, paths, {
      providerId: "fake",
      bootstrapFiles: ["AGENTS.md"]
    });
    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "fake",
      capabilities: { agent: false, model: true, auth: false, passthrough: false },
      onInvoke: (options) => captured.push(options)
    });

    const registry = new ProviderRegistry();
    registry.register("fake", () => provider);

    const service = createProviderService(fileSystem, registry);
    await service.setProviderConfig(paths, "fake", {
      FAKE_PROVIDER_TOKEN: "stored-token"
    });

    await service.invokeAgent(paths, "orchestrator", {
      message: "hello",
      env: {
        EXTRA_FLAG: "1"
      }
    });

    expect(captured[0]?.env?.FAKE_PROVIDER_TOKEN).toBe("stored-token");
    expect(captured[0]?.env?.EXTRA_FLAG).toBe("1");
  });

  it("allows runtime env to override stored provider config", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await seedAgent(fileSystem, paths, {
      providerId: "fake",
      bootstrapFiles: ["AGENTS.md"]
    });
    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "fake",
      capabilities: { agent: false, model: true, auth: false, passthrough: false },
      onInvoke: (options) => captured.push(options)
    });

    const registry = new ProviderRegistry();
    registry.register("fake", () => provider);

    const service = createProviderService(fileSystem, registry);
    await service.setProviderConfig(paths, "fake", {
      FAKE_PROVIDER_TOKEN: "stored-token"
    });

    await service.invokeAgent(paths, "orchestrator", {
      message: "hello",
      env: {
        FAKE_PROVIDER_TOKEN: "runtime-token"
      }
    });

    expect(captured[0]?.env?.FAKE_PROVIDER_TOKEN).toBe("runtime-token");
  });

  it("throws InvalidAgentConfigError when agent config json is malformed", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await fileSystem.writeFile(path.join(paths.agentsDir, "orchestrator", "config.json"), "{not-json");
    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");

    const registry = new ProviderRegistry();
    registry.register("fake", () =>
      createProvider({
        id: "fake",
        capabilities: { agent: false, model: true, auth: false, passthrough: false },
        onInvoke: () => undefined
      })
    );

    const service = createProviderService(fileSystem, registry);
    await expect(service.invokeAgent(paths, "orchestrator", { message: "hello" })).rejects.toBeInstanceOf(
      InvalidAgentConfigError
    );
  });

  it("throws InvalidProviderConfigError when provider config schema is invalid", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await seedAgent(fileSystem, paths, {
      providerId: "fake",
      bootstrapFiles: ["AGENTS.md"]
    });
    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");
    await fileSystem.ensureDir(path.join(paths.providersDir, "fake"));
    await fileSystem.writeFile(
      path.join(paths.providersDir, "fake", "config.json"),
      JSON.stringify({ schemaVersion: 999, providerId: "fake", env: {}, updatedAt: "2026-02-06T00:00:00.000Z" })
    );

    const registry = new ProviderRegistry();
    registry.register("fake", () =>
      createProvider({
        id: "fake",
        capabilities: { agent: false, model: true, auth: false, passthrough: false },
        onInvoke: () => undefined
      })
    );

    const service = createProviderService(fileSystem, registry);
    await expect(service.invokeAgent(paths, "orchestrator", { message: "hello" })).rejects.toBeInstanceOf(
      InvalidProviderConfigError
    );
  });
});

function createProvider(params: {
  id: string;
  capabilities: Provider["capabilities"];
  onInvoke: (options: ProviderInvokeOptions) => void;
}): Provider {
  return {
    id: params.id,
    displayName: params.id,
    kind: "cli",
    capabilities: params.capabilities,
    async invoke(options) {
      params.onInvoke(options);
      return {
        code: 0,
        stdout: "ok\n",
        stderr: ""
      };
    }
  };
}

async function createPaths(root: string): Promise<{ paths: OpenGoatPaths; fileSystem: NodeFileSystem }> {
  const fileSystem = new NodeFileSystem();
  const paths: OpenGoatPaths = {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
    agentsDir: path.join(root, "agents"),
    skillsDir: path.join(root, "skills"),
    providersDir: path.join(root, "providers"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json")
  };

  await fileSystem.ensureDir(paths.workspacesDir);
  await fileSystem.ensureDir(paths.agentsDir);
  await fileSystem.ensureDir(paths.skillsDir);
  await fileSystem.ensureDir(paths.providersDir);
  await fileSystem.ensureDir(paths.runsDir);
  await fileSystem.ensureDir(path.join(paths.workspacesDir, "orchestrator"));
  await fileSystem.ensureDir(path.join(paths.agentsDir, "orchestrator"));

  return { paths, fileSystem };
}

async function seedAgent(
  fileSystem: NodeFileSystem,
  paths: OpenGoatPaths,
  params: { providerId: string; bootstrapFiles: string[] }
): Promise<void> {
  await fileSystem.writeFile(
    path.join(paths.agentsDir, "orchestrator", "config.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "orchestrator",
        displayName: "Orchestrator",
        provider: {
          id: params.providerId
        },
        prompt: {
          bootstrapFiles: params.bootstrapFiles
        },
        runtime: {
          bootstrapMaxChars: 1000
        }
      },
      null,
      2
    ) + "\n"
  );
}

function createProviderService(fileSystem: NodeFileSystem, registry: ProviderRegistry): ProviderService {
  const pathPort = new NodePathPort();
  return new ProviderService({
    fileSystem,
    pathPort,
    providerRegistry: registry,
    workspaceContextService: new WorkspaceContextService({ fileSystem, pathPort }),
    skillService: new SkillService({ fileSystem, pathPort }),
    nowIso: () => "2026-02-06T00:00:00.000Z"
  });
}
