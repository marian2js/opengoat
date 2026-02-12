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
        stdout: "hello from ceo\n",
        stderr: "",
        agentId: "ceo",
        providerId: "openclaw"
      }))
    };

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({
        enabled: true,
        info: {
          agentId: "ceo",
          sessionKey: "agent:ceo:main",
          sessionId: "session-1",
          transcriptPath: path.join(paths.sessionsDir, "ceo", "session-1.jsonl"),
          workspacePath: path.join(paths.workspacesDir, "ceo"),
          projectPath: tempDir,
          isNewSession: true
        },
        compactionApplied: false
      })),
      recordAssistantReply: vi.fn(async () => ({
        sessionKey: "agent:ceo:main",
        sessionId: "session-1",
        transcriptPath: path.join(paths.sessionsDir, "ceo", "session-1.jsonl"),
        applied: false,
        compactedMessages: 0
      }))
    };

    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["ceo"]) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    const result = await service.runAgent(paths, "ceo", {
      message: "hello",
      cwd: tempDir
    });

    expect(providerService.invokeAgent).toHaveBeenCalledWith(
      paths,
      "ceo",
      expect.objectContaining({
        providerSessionId: "session-1"
      }),
      expect.any(Object)
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("hello from ceo");
    expect(result.orchestration?.mode).toBe("single-agent");
    expect(result.orchestration?.steps).toEqual([]);
    expect(result.orchestration?.sessionGraph.nodes[0]?.agentId).toBe("ceo");

    const trace = JSON.parse(await readFile(result.tracePath, "utf8")) as {
      orchestration?: { mode?: string; steps?: unknown[] };
    };
    expect(trace.orchestration?.mode).toBe("single-agent");
    expect(trace.orchestration?.steps).toEqual([]);
  });

  it("uses prepared session project path as cwd when no cwd is provided", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-manager-runtime-cwd-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);
    const projectPath = path.join(tempDir, "saaslib");

    const providerService = {
      invokeAgent: vi.fn(async () => ({
        code: 0,
        stdout: "ok\n",
        stderr: "",
        agentId: "ceo",
        providerId: "openclaw"
      }))
    };

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({
        enabled: true,
        info: {
          agentId: "ceo",
          sessionKey: "workspace:saaslib",
          sessionId: "session-2",
          transcriptPath: path.join(paths.sessionsDir, "ceo", "session-2.jsonl"),
          workspacePath: path.join(paths.workspacesDir, "ceo"),
          projectPath,
          isNewSession: false
        },
        compactionApplied: false
      })),
      recordAssistantReply: vi.fn(async () => ({
        sessionKey: "workspace:saaslib",
        sessionId: "session-2",
        transcriptPath: path.join(paths.sessionsDir, "ceo", "session-2.jsonl"),
        applied: false,
        compactedMessages: 0
      }))
    };

    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["ceo"]) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    await service.runAgent(paths, "ceo", {
      message: "ship it"
    });

    expect(providerService.invokeAgent).toHaveBeenCalledWith(
      paths,
      "ceo",
      expect.objectContaining({
        providerSessionId: "session-2",
        cwd: projectPath
      }),
      expect.any(Object)
    );
  });

  it("adds project context instructions when project path differs from workspace", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "opengoat-manager-runtime-prompt-"));
    tempDirs.push(tempDir);
    const paths = createPaths(tempDir);
    const projectPath = path.join(tempDir, "saaslib");

    const providerService = {
      invokeAgent: vi.fn(async () => ({
        code: 0,
        stdout: "ok\n",
        stderr: "",
        agentId: "ceo",
        providerId: "openclaw"
      }))
    };

    const sessionService = {
      prepareRunSession: vi.fn(async () => ({
        enabled: true,
        info: {
          agentId: "ceo",
          sessionKey: "workspace:saaslib",
          sessionId: "session-3",
          transcriptPath: path.join(paths.sessionsDir, "ceo", "session-3.jsonl"),
          workspacePath: path.join(paths.workspacesDir, "ceo"),
          projectPath,
          isNewSession: false
        },
        compactionApplied: false
      })),
      recordAssistantReply: vi.fn(async () => ({
        sessionKey: "workspace:saaslib",
        sessionId: "session-3",
        transcriptPath: path.join(paths.sessionsDir, "ceo", "session-3.jsonl"),
        applied: false,
        compactedMessages: 0
      }))
    };

    const service = new OrchestrationService({
      providerService: providerService as unknown as ProviderService,
      agentManifestService: createManifestServiceStub(["ceo"]) as unknown as AgentManifestService,
      sessionService: sessionService as unknown as SessionService,
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowIso: () => "2026-02-10T10:00:00.000Z"
    });

    await service.runAgent(paths, "ceo", {
      message: "ship it"
    });

    expect(providerService.invokeAgent).toHaveBeenCalledWith(
      paths,
      "ceo",
      expect.objectContaining({
        systemPrompt: expect.stringContaining(`Session project path: ${projectPath}`)
      }),
      expect.any(Object)
    );
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
      agentManifestService: createManifestServiceStub(["ceo", "developer"]) as unknown as AgentManifestService,
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

});

function createPaths(root: string): OpenGoatPaths {
  return {
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
}

function createManifestServiceStub(agentIds: string[]) {
  return {
    listManifests: vi.fn(async () =>
      agentIds.map((agentId) => ({
        agentId,
        filePath: "",
        workspaceDir: "",
        body: "",
        source: "derived",
        metadata: {
          id: agentId,
          name: agentId,
          description: `${agentId} agent`,
          type: agentId === "ceo" ? "manager" : "individual",
          reportsTo: agentId === "ceo" ? null : "ceo",
          discoverable: true,
          tags: [],
          skills: agentId === "ceo" ? ["board-manager"] : [],
          delegation: {
            canReceive: true,
            canDelegate: agentId === "ceo"
          },
          priority: 50
        }
      }))
    )
  };
}
