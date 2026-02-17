import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import { BaseProvider } from "../base-provider.js";
import type { ProviderModule } from "../provider-module.js";
import { ProviderRegistry } from "../registry.js";
import type {
  ProviderExecutionResult,
  ProviderInvokeOptions,
} from "../types.js";
import { ProviderService } from "./provider.service.js";
import { NodeFileSystem } from "../../../platform/node/node-file-system.js";
import { NodePathPort } from "../../../platform/node/node-path.port.js";

class RecordingProvider extends BaseProvider {
  public readonly invocations: ProviderInvokeOptions[] = [];
  private readonly providerSessionId: string | undefined;

  public constructor(options: {
    id: string;
    displayName: string;
    capabilities: {
      agent: boolean;
      model: boolean;
      auth: boolean;
      passthrough: boolean;
      reportees: boolean;
      agentCreate?: boolean;
      agentDelete?: boolean;
    };
    providerSessionId?: string;
  }) {
    super({
      id: options.id,
      displayName: options.displayName,
      kind: "cli",
      capabilities: options.capabilities,
    });
    this.providerSessionId = options.providerSessionId;
  }

  public async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    this.invocations.push(options);
    return {
      code: 0,
      stdout: `handled-by:${this.id}`,
      stderr: "",
      providerSessionId: this.providerSessionId,
    };
  }
}

describe("ProviderService", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  });

  it("reads and writes per-agent provider binding", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-provider-service-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const { service } = await createService(paths);

    await writeAgentConfig(paths, "developer", {
      id: "developer",
      displayName: "Developer",
      runtime: {
        adapter: "openclaw",
      },
    });

    await service.setAgentProvider(paths, "developer", "claude-code");

    const binding = await service.getAgentProvider(paths, "developer");
    expect(binding).toEqual({
      agentId: "developer",
      providerId: "claude-code",
    });

    const config = await readAgentConfig(paths, "developer");
    expect(config.runtime?.provider?.id).toBe("claude-code");
    expect(config.runtime?.adapter).toBeUndefined();
  });

  it("keeps ceo bound to openclaw", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-provider-service-ceo-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const { service } = await createService(paths);
    await writeAgentConfig(paths, "ceo", {
      id: "ceo",
      displayName: "CEO",
      runtime: {
        provider: {
          id: "openclaw",
        },
      },
    });

    await expect(service.setAgentProvider(paths, "ceo", "claude-code")).rejects.toThrow(
      'ceo provider is fixed to "openclaw".',
    );

    const binding = await service.getAgentProvider(paths, "ceo");
    expect(binding.providerId).toBe("openclaw");
  });

  it("maps OpenGoat session ids to provider-native session ids for non-openclaw providers", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-provider-service-session-map-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const { service, claudeProvider } = await createService(paths);
    await writeAgentConfig(paths, "developer", {
      id: "developer",
      displayName: "Developer",
      runtime: {
        provider: {
          id: "claude-code",
        },
      },
    });

    await service.invokeAgent(paths, "developer", {
      message: "first",
      providerSessionId: "opengoat-session-1",
    });
    await service.invokeAgent(paths, "developer", {
      message: "second",
      providerSessionId: "opengoat-session-1",
    });

    expect(claudeProvider.invocations[0]?.providerSessionId).toBeUndefined();
    expect(claudeProvider.invocations[1]?.providerSessionId).toBe(
      "claude-session-123",
    );
  });

  it("returns provider runtime profile with provider-specific workspace policy", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-provider-service-runtime-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const { service } = await createService(paths);
    await writeAgentConfig(paths, "developer", {
      id: "developer",
      displayName: "Developer",
      runtime: {
        provider: {
          id: "claude-code",
        },
      },
    });

    const profile = await service.getAgentRuntimeProfile(paths, "developer");
    expect(profile).toEqual({
      agentId: "developer",
      providerId: "claude-code",
      providerKind: "cli",
      workspaceAccess: "agent-workspace",
      roleSkillDirectories: [".claude/skills"],
    });
  });

  it("lists managed role skill directories from registered provider runtime policies", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-provider-service-skill-dirs-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const { service } = await createService(paths);
    const directories = await service.listProviderRoleSkillDirectories();

    expect(directories).toEqual([".claude/skills", "skills"]);
  });
});

async function createService(paths: OpenGoatPaths): Promise<{
  service: ProviderService;
  claudeProvider: RecordingProvider;
}> {
  const registry = new ProviderRegistry();
  const openClawProvider = new RecordingProvider({
    id: "openclaw",
    displayName: "OpenClaw",
    capabilities: {
      agent: true,
      model: true,
      auth: true,
      passthrough: true,
      reportees: true,
      agentCreate: true,
      agentDelete: true,
    },
  });
  const claudeProvider = new RecordingProvider({
    id: "claude-code",
    displayName: "Claude Code",
    capabilities: {
      agent: false,
      model: true,
      auth: true,
      passthrough: true,
      reportees: false,
    },
    providerSessionId: "claude-session-123",
  });

  const openClawModule: ProviderModule = {
    id: "openclaw",
    create: () => openClawProvider,
    runtime: {
      invocation: {
        cwd: "provider-default",
      },
      skills: {
        directories: ["skills"],
      },
    },
  };
  const claudeModule: ProviderModule = {
    id: "claude-code",
    create: () => claudeProvider,
    runtime: {
      invocation: {
        cwd: "agent-workspace",
      },
      skills: {
        directories: [".claude/skills"],
      },
    },
  };

  registry.register("openclaw", () => openClawProvider, openClawModule);
  registry.register("claude-code", () => claudeProvider, claudeModule);

  const fileSystem = new NodeFileSystem();
  await Promise.all([
    fileSystem.ensureDir(paths.homeDir),
    fileSystem.ensureDir(paths.agentsDir),
    fileSystem.ensureDir(paths.providersDir),
  ]);

  return {
    service: new ProviderService({
      fileSystem,
      pathPort: new NodePathPort(),
      providerRegistry: registry,
      nowIso: () => "2026-02-15T12:00:00.000Z",
    }),
    claudeProvider,
  };
}

function createPaths(root: string): OpenGoatPaths {
  return {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
    organizationDir: path.join(root, "organization"),
    agentsDir: path.join(root, "agents"),
    skillsDir: path.join(root, "skills"),
    providersDir: path.join(root, "providers"),
    sessionsDir: path.join(root, "sessions"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json"),
  };
}

async function writeAgentConfig(
  paths: OpenGoatPaths,
  agentId: string,
  config: Record<string, unknown>,
): Promise<void> {
  const fileSystem = new NodeFileSystem();
  const agentDir = path.join(paths.agentsDir, agentId);
  await fileSystem.ensureDir(agentDir);
  await fileSystem.writeFile(
    path.join(agentDir, "config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

async function readAgentConfig(
  paths: OpenGoatPaths,
  agentId: string,
): Promise<{
  runtime?: {
    adapter?: string;
    provider?: {
      id?: string;
    };
  };
}> {
  const fileSystem = new NodeFileSystem();
  const raw = await fileSystem.readFile(path.join(paths.agentsDir, agentId, "config.json"));
  return JSON.parse(raw) as {
    runtime?: {
      adapter?: string;
      provider?: {
        id?: string;
      };
    };
  };
}
