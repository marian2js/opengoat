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
  it("loads provider registry lazily only when first provider operation is requested", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);
    const { fileSystem } = await createPaths(root);

    const registry = new ProviderRegistry();
    registry.register("fake", () =>
      createProvider({
        id: "fake",
        kind: "cli",
        capabilities: { agent: false, model: true, auth: false, passthrough: false },
        onInvoke: () => undefined
      })
    );

    let loadCount = 0;
    const service = new ProviderService({
      fileSystem,
      pathPort: new NodePathPort(),
      providerRegistry: () => {
        loadCount += 1;
        return registry;
      },
      workspaceContextService: new WorkspaceContextService({
        fileSystem,
        pathPort: new NodePathPort()
      }),
      skillService: new SkillService({
        fileSystem,
        pathPort: new NodePathPort()
      }),
      nowIso: () => "2026-02-06T00:00:00.000Z"
    });

    expect(loadCount).toBe(0);
    await service.listProviders();
    expect(loadCount).toBe(1);
    await service.listProviders();
    expect(loadCount).toBe(1);
  });

  it("injects workspace context into system prompt and defaults cwd to workspace", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await seedAgent(fileSystem, paths, {
      agentId: "orchestrator",
      providerId: "fake",
      bootstrapFiles: ["AGENTS.md", "MISSING.md"]
    });

    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "fake",
      kind: "cli",
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

  it("uses skillsPromptOverride when provided by orchestration runtime", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await seedAgent(fileSystem, paths, {
      agentId: "orchestrator",
      providerId: "fake",
      bootstrapFiles: ["AGENTS.md"]
    });
    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "fake",
      kind: "http",
      capabilities: { agent: false, model: true, auth: false, passthrough: false },
      onInvoke: (options) => captured.push(options)
    });

    const registry = new ProviderRegistry();
    registry.register("fake", () => provider);

    const service = createProviderService(fileSystem, registry);
    await service.invokeAgent(paths, "orchestrator", {
      message: "hello",
      skillsPromptOverride: "## Skills\n<available_skills>\n  <skill><id>x</id></skill>\n</available_skills>"
    });

    expect(captured[0]?.systemPrompt).toContain("<available_skills>");
    expect(captured[0]?.systemPrompt).toContain("<id>x</id>");
  });

  it("does not force agent option for providers without agent capability", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await seedAgent(fileSystem, paths, {
      agentId: "orchestrator",
      providerId: "no-agent",
      bootstrapFiles: ["AGENTS.md"]
    });
    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "no-agent",
      kind: "cli",
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
      agentId: "orchestrator",
      providerId: "fake",
      bootstrapFiles: ["AGENTS.md"]
    });
    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "fake",
      kind: "cli",
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
      agentId: "orchestrator",
      providerId: "fake",
      bootstrapFiles: ["AGENTS.md"]
    });
    await fileSystem.writeFile(path.join(paths.workspacesDir, "orchestrator", "AGENTS.md"), "# Rules\n");

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "fake",
      kind: "cli",
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
        kind: "cli",
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
      agentId: "orchestrator",
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
        kind: "cli",
        capabilities: { agent: false, model: true, auth: false, passthrough: false },
        onInvoke: () => undefined
      })
    );

    const service = createProviderService(fileSystem, registry);
    await expect(service.invokeAgent(paths, "orchestrator", { message: "hello" })).rejects.toBeInstanceOf(
      InvalidProviderConfigError
    );
  });

  it("runs external agents in caller cwd without injecting workspace prompt", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await fileSystem.ensureDir(path.join(paths.workspacesDir, "developer"));
    await fileSystem.ensureDir(path.join(paths.agentsDir, "developer"));
    await seedAgent(fileSystem, paths, {
      agentId: "developer",
      providerId: "ext-cli",
      bootstrapFiles: ["AGENTS.md"]
    });

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "ext-cli",
      kind: "cli",
      capabilities: { agent: true, model: true, auth: false, passthrough: false },
      onInvoke: (options) => captured.push(options)
    });

    const registry = new ProviderRegistry();
    registry.register("ext-cli", () => provider);

    const service = createProviderService(fileSystem, registry);
    await service.invokeAgent(paths, "developer", { message: "hello" });
    expect(captured[0]?.cwd).toBe(process.cwd());
    expect(captured[0]?.systemPrompt).toBeUndefined();

    const requestedCwd = path.join(root, "target-project");
    await fileSystem.ensureDir(requestedCwd);
    await service.invokeAgent(paths, "developer", { message: "hello", cwd: requestedCwd });
    expect(captured[1]?.cwd).toBe(requestedCwd);
    expect(captured[1]?.systemPrompt).toBeUndefined();
  });

  it("keeps non-orchestrator HTTP agents internal by default", async () => {
    const root = await createTempDir("opengoat-provider-service-");
    roots.push(root);

    const { paths, fileSystem } = await createPaths(root);
    await fileSystem.ensureDir(path.join(paths.workspacesDir, "research"));
    await fileSystem.ensureDir(path.join(paths.agentsDir, "research"));
    await seedAgent(fileSystem, paths, {
      agentId: "research",
      providerId: "http-provider",
      bootstrapFiles: ["AGENTS.md"]
    });
    await fileSystem.writeFile(path.join(paths.workspacesDir, "research", "AGENTS.md"), "# Research Rules\n");

    const captured: ProviderInvokeOptions[] = [];
    const provider = createProvider({
      id: "http-provider",
      kind: "http",
      capabilities: { agent: false, model: true, auth: false, passthrough: false },
      onInvoke: (options) => captured.push(options)
    });

    const registry = new ProviderRegistry();
    registry.register("http-provider", () => provider);

    const service = createProviderService(fileSystem, registry);
    await service.invokeAgent(paths, "research", { message: "hello" });

    expect(captured[0]?.cwd).toBe(path.join(paths.workspacesDir, "research"));
    expect(captured[0]?.systemPrompt).toContain("# Project Context");
    expect(captured[0]?.systemPrompt).toContain("## AGENTS.md");
  });
});

function createProvider(params: {
  id: string;
  kind: Provider["kind"];
  capabilities: Provider["capabilities"];
  onInvoke: (options: ProviderInvokeOptions) => void;
}): Provider {
  return {
    id: params.id,
    displayName: params.id,
    kind: params.kind,
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
    sessionsDir: path.join(root, "sessions"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json")
  };

  await fileSystem.ensureDir(paths.workspacesDir);
  await fileSystem.ensureDir(paths.agentsDir);
  await fileSystem.ensureDir(paths.skillsDir);
  await fileSystem.ensureDir(paths.providersDir);
  await fileSystem.ensureDir(paths.sessionsDir);
  await fileSystem.ensureDir(paths.runsDir);
  await fileSystem.ensureDir(path.join(paths.workspacesDir, "orchestrator"));
  await fileSystem.ensureDir(path.join(paths.agentsDir, "orchestrator"));

  return { paths, fileSystem };
}

async function seedAgent(
  fileSystem: NodeFileSystem,
  paths: OpenGoatPaths,
  params: { agentId: string; providerId: string; bootstrapFiles: string[] }
): Promise<void> {
  await fileSystem.writeFile(
    path.join(paths.agentsDir, params.agentId, "config.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: params.agentId,
        displayName: params.agentId,
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
