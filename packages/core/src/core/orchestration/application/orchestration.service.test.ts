import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentManifestService } from "../../agents/index.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { ProviderService } from "../../providers/index.js";
import type { SessionService } from "../../sessions/index.js";
import { NodeFileSystem } from "../../../platform/node/node-file-system.js";
import { NodePathPort } from "../../../platform/node/node-path.port.js";
import { OrchestrationService } from "./orchestration.service.js";

describe("OrchestrationService manager runtime", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  it("runs a direct single-agent invocation and writes trace", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-manager-runtime-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const providerService = {
      invokeAgent: vi.fn(async () => ({
        code: 0,
        stdout: "hello from goat\n",
        stderr: "",
        agentId: "goat",
        providerId: "openclaw"
      }))
    };

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({
        enabled: true,
        info: {
          agentId: "goat",
          sessionKey: "agent:goat:main",
          sessionId: "session-1",
          transcriptPath: path.join(paths.sessionsDir, "goat", "session-1.jsonl"),
          workspacePath: path.join(paths.workspacesDir, "goat"),
          isNewSession: true
        },
        compactionApplied: false
      })),
      recordAssistantReply: vi.fn(async () => ({
        sessionKey: "agent:goat:main",
        sessionId: "session-1",
        transcriptPath: path.join(paths.sessionsDir, "goat", "session-1.jsonl"),
        applied: false,
        compactedMessages: 0
      }))
    };

    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["goat"], paths.workspacesDir) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    const result = await service.runAgent(paths, "goat", {
      message: "hello",
      cwd: tempDir
    });

    expect(providerService.invokeAgent).toHaveBeenCalledWith(
      paths,
      "goat",
      expect.objectContaining({
        providerSessionId: "session-1"
      }),
      expect.any(Object)
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("hello from goat");

    const trace = JSON.parse(await readFile(result.tracePath, "utf8")) as {
      entryAgentId?: string;
      execution?: { stdout?: string };
    };
    expect(trace.entryAgentId).toBe("goat");
    expect(trace.execution?.stdout).toContain("hello from goat");
  });

  it("does not pass cwd for provider-default runtimes when no cwd is provided", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-manager-runtime-cwd-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const providerService = {
      invokeAgent: vi.fn(async () => ({
        code: 0,
        stdout: "ok\n",
        stderr: "",
        agentId: "goat",
        providerId: "openclaw"
      }))
    };

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({
        enabled: true,
        info: {
          agentId: "goat",
          sessionKey: "workspace:saaslib",
          sessionId: "session-2",
          transcriptPath: path.join(paths.sessionsDir, "goat", "session-2.jsonl"),
          workspacePath: path.join(paths.workspacesDir, "goat"),
          isNewSession: false
        },
        compactionApplied: false
      })),
      recordAssistantReply: vi.fn(async () => ({
        sessionKey: "workspace:saaslib",
        sessionId: "session-2",
        transcriptPath: path.join(paths.sessionsDir, "goat", "session-2.jsonl"),
        applied: false,
        compactedMessages: 0
      }))
    };

    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["goat"], paths.workspacesDir) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    await service.runAgent(paths, "goat", {
      message: "ship it"
    });

    expect(providerService.invokeAgent).toHaveBeenCalledWith(
      paths,
      "goat",
      expect.objectContaining({
        providerSessionId: "session-2"
      }),
      expect.any(Object)
    );
    expect(providerService.invokeAgent.mock.calls[0]?.[2]).not.toHaveProperty("cwd");
  });

  it("does not inject project-context prompts for provider-default runtimes", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-manager-runtime-prompt-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const providerService = {
      invokeAgent: vi.fn(async () => ({
        code: 0,
        stdout: "ok\n",
        stderr: "",
        agentId: "goat",
        providerId: "openclaw"
      }))
    };

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({
        enabled: true,
        info: {
          agentId: "goat",
          sessionKey: "workspace:saaslib",
          sessionId: "session-3",
          transcriptPath: path.join(paths.sessionsDir, "goat", "session-3.jsonl"),
          workspacePath: path.join(paths.workspacesDir, "goat"),
          isNewSession: false
        },
        compactionApplied: false
      })),
      recordAssistantReply: vi.fn(async () => ({
        sessionKey: "workspace:saaslib",
        sessionId: "session-3",
        transcriptPath: path.join(paths.sessionsDir, "goat", "session-3.jsonl"),
        applied: false,
        compactedMessages: 0
      }))
    };

    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["goat"], paths.workspacesDir) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    await service.runAgent(paths, "goat", {
      message: "ship it"
    });

    expect(providerService.invokeAgent).toHaveBeenCalledWith(
      paths,
      "goat",
      expect.objectContaining({}),
      expect.any(Object)
    );
    expect(providerService.invokeAgent.mock.calls[0]?.[2]).not.toHaveProperty("systemPrompt");
  });

  it("uses agent workspace cwd for non-openclaw providers", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-manager-runtime-non-openclaw-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);
    const workspacePath = path.join(paths.workspacesDir, "developer");
    const projectPath = path.join(tempDir, "saaslib");

    const providerService = {
      invokeAgent: vi.fn(async () => ({
        code: 0,
        stdout: "ok\n",
        stderr: "",
        agentId: "developer",
        providerId: "cursor"
      })),
      getAgentRuntimeProfile: vi.fn(async () => ({
        agentId: "developer",
        providerId: "cursor",
        providerKind: "cli",
        workspaceAccess: "agent-workspace",
        roleSkillDirectories: [".cursor/skills"],
        roleSkillIds: {
          manager: ["og-boards"],
          individual: ["og-boards"],
        },
      }))
    };

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({
        enabled: true,
        info: {
          agentId: "developer",
          sessionKey: "workspace:saaslib",
          sessionId: "session-4",
          transcriptPath: path.join(paths.sessionsDir, "developer", "session-4.jsonl"),
          workspacePath,
          isNewSession: false
        },
        compactionApplied: false
      })),
      recordAssistantReply: vi.fn(async () => ({
        sessionKey: "workspace:saaslib",
        sessionId: "session-4",
        transcriptPath: path.join(paths.sessionsDir, "developer", "session-4.jsonl"),
        applied: false,
        compactedMessages: 0
      }))
    };

    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["goat", "developer"], paths.workspacesDir) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    await service.runAgent(paths, "developer", {
      message: "ship it",
      cwd: projectPath
    });

    expect(providerService.invokeAgent).toHaveBeenCalledWith(
      paths,
      "developer",
      expect.objectContaining({
        providerSessionId: "session-4",
        cwd: workspacePath
      }),
      expect.any(Object)
    );
    expect(providerService.invokeAgent.mock.calls[0]?.[2]).not.toHaveProperty("systemPrompt");
  });

  it("uses target agent session scope by default", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-manager-session-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({ enabled: false })),
      recordAssistantReply: vi.fn()
    };

    const service = new OrchestrationService({
      providerService: {
        invokeAgent: vi.fn(async () => ({
          code: 0,
          stdout: "ok\n",
          stderr: "",
          agentId: "developer",
          providerId: "openclaw"
        }))
      } as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["goat", "developer"]) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    await service.runAgent(paths, "developer", {
      message: "ship it",
      cwd: tempDir
    });

    expect(sessionService.prepareRunSession).toHaveBeenCalledWith(
      paths,
      "developer",
      expect.objectContaining({ userMessage: "ship it" })
    );
  });

  it("recreates missing provider agent registration and retries once", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-manager-repair-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const providerService = {
      invokeAgent: vi
        .fn()
        .mockResolvedValueOnce({
          code: 1,
          stdout: "",
          stderr: 'invalid agent params: unknown agent id "goat"',
          agentId: "goat",
          providerId: "openclaw"
        })
        .mockResolvedValueOnce({
          code: 0,
          stdout: "Recovered after repair\n",
          stderr: "",
          agentId: "goat",
          providerId: "openclaw"
        }),
      createProviderAgent: vi.fn(async () => ({
        code: 0,
        stdout: "",
        stderr: "",
        agentId: "goat",
        providerId: "openclaw"
      }))
    };

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({
        enabled: true,
        info: {
          agentId: "goat",
          sessionKey: "agent:goat:main",
          sessionId: "session-repair",
          transcriptPath: path.join(paths.sessionsDir, "goat", "session-repair.jsonl"),
          workspacePath: path.join(paths.workspacesDir, "goat"),
          isNewSession: true
        },
        compactionApplied: false
      })),
      recordAssistantReply: vi.fn(async () => ({
        sessionKey: "agent:goat:main",
        sessionId: "session-repair",
        transcriptPath: path.join(paths.sessionsDir, "goat", "session-repair.jsonl"),
        applied: false,
        compactedMessages: 0
      }))
    };

    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["goat"], paths.workspacesDir) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    const result = await service.runAgent(paths, "goat", {
      message: "hello"
    });

    expect(providerService.invokeAgent).toHaveBeenCalledTimes(2);
    expect(providerService.createProviderAgent).toHaveBeenCalledWith(
      paths,
      "goat",
      expect.objectContaining({
        displayName: "goat",
        workspaceDir: path.join(paths.workspacesDir, "goat"),
        internalConfigDir: path.join(paths.agentsDir, "goat")
      })
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Recovered after repair");
    expect(sessionService.recordAssistantReply).toHaveBeenCalledWith(
      paths,
      expect.objectContaining({
        sessionId: "session-repair"
      }),
      "Recovered after repair"
    );
  });

  it("restarts local gateway when missing-agent retry still fails", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-manager-repair-restart-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const providerService = {
      invokeAgent: vi
        .fn()
        .mockResolvedValueOnce({
          code: 1,
          stdout: "",
          stderr: 'invalid agent params: unknown agent id "goat"',
          agentId: "goat",
          providerId: "openclaw"
        })
        .mockResolvedValueOnce({
          code: 1,
          stdout: "",
          stderr: 'invalid agent params: unknown agent id "goat"',
          agentId: "goat",
          providerId: "openclaw"
        })
        .mockResolvedValueOnce({
          code: 0,
          stdout: "Recovered after gateway restart\n",
          stderr: "",
          agentId: "goat",
          providerId: "openclaw"
        }),
      createProviderAgent: vi.fn(async () => ({
        code: 0,
        stdout: "",
        stderr: "",
        agentId: "goat",
        providerId: "openclaw"
      })),
      restartLocalGateway: vi.fn(async () => true)
    };

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({
        enabled: true,
        info: {
          agentId: "goat",
          sessionKey: "agent:goat:main",
          sessionId: "session-repair-restart",
          transcriptPath: path.join(paths.sessionsDir, "goat", "session-repair-restart.jsonl"),
          workspacePath: path.join(paths.workspacesDir, "goat"),
          isNewSession: true
        },
        compactionApplied: false
      })),
      recordAssistantReply: vi.fn(async () => ({
        sessionKey: "agent:goat:main",
        sessionId: "session-repair-restart",
        transcriptPath: path.join(paths.sessionsDir, "goat", "session-repair-restart.jsonl"),
        applied: false,
        compactedMessages: 0
      }))
    };

    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["goat"], paths.workspacesDir) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    const result = await service.runAgent(paths, "goat", {
      message: "hello"
    });

    expect(providerService.createProviderAgent).toHaveBeenCalledTimes(1);
    expect(providerService.restartLocalGateway).toHaveBeenCalledTimes(1);
    expect(providerService.invokeAgent).toHaveBeenCalledTimes(3);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Recovered after gateway restart");
  });

  it("does not trigger missing-agent repair for generic not-found runtime errors", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-manager-repair-generic-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);

    const providerService = {
      invokeAgent: vi.fn(async () => ({
        code: 1,
        stdout: "",
        stderr: "workspace file not found: /tmp/missing.txt",
        agentId: "goat",
        providerId: "openclaw"
      })),
      createProviderAgent: vi.fn(async () => ({
        code: 0,
        stdout: "",
        stderr: "",
        agentId: "goat",
        providerId: "openclaw"
      }))
    };

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({
        enabled: true,
        info: {
          agentId: "goat",
          sessionKey: "agent:goat:main",
          sessionId: "session-generic-not-found",
          transcriptPath: path.join(paths.sessionsDir, "goat", "session-generic-not-found.jsonl"),
          workspacePath: path.join(paths.workspacesDir, "goat"),
          isNewSession: true
        },
        compactionApplied: false
      })),
      recordAssistantReply: vi.fn(async () => ({
        sessionKey: "agent:goat:main",
        sessionId: "session-generic-not-found",
        transcriptPath: path.join(paths.sessionsDir, "goat", "session-generic-not-found.jsonl"),
        applied: false,
        compactedMessages: 0
      }))
    };

    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["goat"], paths.workspacesDir) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    const result = await service.runAgent(paths, "goat", {
      message: "hello"
    });

    expect(providerService.invokeAgent).toHaveBeenCalledTimes(1);
    expect(providerService.createProviderAgent).not.toHaveBeenCalled();
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("workspace file not found");
  });

});

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
    agentsIndexJsonPath: path.join(root, "agents.json")
  };
}

function createManifestServiceStub(
  agentIds: string[],
  workspaceRoot = path.join("/tmp", "opengoat", "workspaces")
) {
  const manifests = agentIds.map((agentId) => ({
    agentId,
    filePath: "",
    workspaceDir: path.join(workspaceRoot, agentId),
    body: "",
    source: "derived",
    metadata: {
      id: agentId,
      name: agentId,
      description: `${agentId} agent`,
      type: agentId === "goat" ? "manager" : "individual",
      reportsTo: agentId === "goat" ? null : "goat",
      discoverable: true,
      tags: [],
      skills: agentId === "goat" ? ["og-board-manager"] : [],
      delegation: {
        canReceive: true,
        canDelegate: agentId === "goat"
      },
      priority: 50
    }
  }));

  return {
    listManifests: vi.fn(async () => manifests),
    getManifest: vi.fn(async (_paths: OpenGoatPaths, agentId: string) => {
      const manifest = manifests.find((entry) => entry.agentId === agentId);
      if (!manifest) {
        throw new Error(`missing manifest for ${agentId}`);
      }
      return manifest;
    })
  };
}
