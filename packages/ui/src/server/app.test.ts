import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOpenGoatUiServer,
  extractRuntimeActivityFromLogLines,
  type OpenClawUiService,
} from "./app.js";

interface AgentDescriptor {
  id: string;
  displayName: string;
  workspaceDir: string;
  internalConfigDir: string;
}

interface AgentCreationResult {
  agent: AgentDescriptor;
  createdPaths: string[];
  skippedPaths: string[];
}

interface AgentDeletionResult {
  agentId: string;
  existed: boolean;
  removedPaths: string[];
  skippedPaths: string[];
}

interface SessionSummary {
  sessionKey: string;
  sessionId: string;
  title: string;
  updatedAt: number;
  transcriptPath: string;
  workspacePath: string;
  projectPath?: string;
  inputChars: number;
  outputChars: number;
  totalChars: number;
  compactionCount: number;
}

interface ResolvedSkill {
  id: string;
  name: string;
  description: string;
  source: string;
}

interface SessionRunInfo {
  agentId: string;
  sessionKey: string;
  sessionId: string;
  transcriptPath: string;
  workspacePath: string;
  projectPath: string;
  isNewSession: boolean;
}

interface TaskEntry {
  createdAt: string;
  createdBy: string;
  content: string;
}

interface TaskRecord {
  taskId: string;
  createdAt: string;
  project: string;
  owner: string;
  assignedTo: string;
  title: string;
  description: string;
  status: string;
  blockers: string[];
  artifacts: TaskEntry[];
  worklog: TaskEntry[];
}

let activeServer: Awaited<ReturnType<typeof createOpenGoatUiServer>> | undefined;
const originalOpenGoatVersion = process.env.OPENGOAT_VERSION;

afterEach(async () => {
  vi.restoreAllMocks();
  if (originalOpenGoatVersion === undefined) {
    delete process.env.OPENGOAT_VERSION;
  } else {
    process.env.OPENGOAT_VERSION = originalOpenGoatVersion;
  }
  if (activeServer) {
    await activeServer.close();
    activeServer = undefined;
  }
});

describe("runtime log extraction", () => {
  it("extracts run-matched OpenClaw runtime activity and strips run ids", () => {
    const startedAtMs = Date.parse("2026-02-13T00:00:00.000Z");
    const lines = [
      JSON.stringify({
        "1": "embedded run tool start: runId=run-abc tool=exec",
        time: "2026-02-13T00:00:01.000Z",
        _meta: { logLevelName: "DEBUG" },
      }),
    ];

    const extracted = extractRuntimeActivityFromLogLines(lines, {
      primaryRunId: "run-abc",
      startedAtMs,
    });

    expect(extracted.nextFallbackRunId).toBeUndefined();
    expect(extracted.activities).toEqual([
      {
        level: "stdout",
        message: "Running tool: exec.",
      },
    ]);
  });

  it("binds to embedded runtime run id when primary run id is not present", () => {
    const startedAtMs = Date.parse("2026-02-13T00:00:00.000Z");
    const lines = [
      JSON.stringify({
        "1": "embedded run start: runId=runtime-42 sessionId=session-1",
        time: "2026-02-13T00:00:01.000Z",
        _meta: { logLevelName: "DEBUG" },
      }),
      JSON.stringify({
        "1": "embedded run tool end: runId=runtime-42 tool=exec durationMs=120",
        time: "2026-02-13T00:00:02.000Z",
        _meta: { logLevelName: "DEBUG" },
      }),
    ];

    const extracted = extractRuntimeActivityFromLogLines(lines, {
      primaryRunId: "orchestration-run-1",
      startedAtMs,
    });

    expect(extracted.nextFallbackRunId).toBe("runtime-42");
    expect(extracted.activities).toEqual([
      {
        level: "stdout",
        message: "Run accepted by OpenClaw.",
      },
      {
        level: "stdout",
        message: "Finished tool: exec (120 ms).",
      },
    ]);
  });
});

describe("OpenGoat UI server API", () => {
  it("returns health metadata", async () => {
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService()
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      homeDir: "/tmp/opengoat-home"
    });
  });

  it("returns a logs snapshot through the stream api", async () => {
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService()
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/logs/stream?follow=false&limit=20"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/x-ndjson");

    const lines = response.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; entries?: unknown[] });

    expect(lines.length).toBe(1);
    expect(lines[0]).toMatchObject({
      type: "snapshot"
    });
    expect(Array.isArray(lines[0]?.entries)).toBe(true);
    expect((lines[0]?.entries ?? []).length).toBeGreaterThan(0);
  });

  it("gets and updates UI server settings through the api", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService({
        homeDir: uniqueHomeDir
      })
    });

    const defaultResponse = await activeServer.inject({
      method: "GET",
      url: "/api/settings"
    });
    expect(defaultResponse.statusCode).toBe(200);
    expect(defaultResponse.json()).toMatchObject({
      settings: {
        notifyManagersOfInactiveAgents: true,
        maxInactivityMinutes: 30,
      },
    });

    const updateResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      payload: {
        notifyManagersOfInactiveAgents: false,
        maxInactivityMinutes: 45,
      },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      settings: {
        notifyManagersOfInactiveAgents: false,
        maxInactivityMinutes: 45,
      },
    });

    const updatedResponse = await activeServer.inject({
      method: "GET",
      url: "/api/settings"
    });
    expect(updatedResponse.statusCode).toBe(200);
    expect(updatedResponse.json()).toMatchObject({
      settings: {
        notifyManagersOfInactiveAgents: false,
        maxInactivityMinutes: 45,
      },
    });
  });

  it("honors persisted cron disable setting during scheduler cycles", async () => {
    vi.useFakeTimers();
    try {
      const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const runTaskCronCycle = vi.fn<NonNullable<OpenClawUiService["runTaskCronCycle"]>>(async () => {
        return {
          ranAt: new Date().toISOString(),
          scannedTasks: 0,
          todoTasks: 0,
          blockedTasks: 0,
          inactiveAgents: 0,
          sent: 0,
          failed: 0
        };
      });

      activeServer = await createOpenGoatUiServer({
        logger: false,
        attachFrontend: false,
        service: {
          ...createMockService({
            homeDir: uniqueHomeDir
          }),
          runTaskCronCycle
        }
      });

      await mkdir(uniqueHomeDir, { recursive: true });
      await writeFile(
        `${uniqueHomeDir}/ui-settings.json`,
        `${JSON.stringify({
          notifyManagersOfInactiveAgents: false,
          maxInactivityMinutes: 30,
        }, null, 2)}\n`,
        "utf8"
      );

      await vi.advanceTimersByTimeAsync(60_000);
      expect(runTaskCronCycle).toHaveBeenCalledTimes(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps legacy taskCronEnabled setting to inactivity notifications", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    await mkdir(uniqueHomeDir, { recursive: true });
    await writeFile(
      `${uniqueHomeDir}/ui-settings.json`,
      `${JSON.stringify(
        {
          taskCronEnabled: false,
          taskCheckFrequencyMinutes: 5,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService({
        homeDir: uniqueHomeDir,
      }),
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/settings",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      settings: {
        notifyManagersOfInactiveAgents: false,
        maxInactivityMinutes: 30,
      },
    });
  });

  it("returns installed and latest versions from the version api", async () => {
    process.env.OPENGOAT_VERSION = "2026.2.9";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          version: "2026.2.10"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService()
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/version"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      version: {
        packageName: "opengoat",
        installedVersion: "2026.2.9",
        latestVersion: "2026.2.10",
        updateAvailable: true,
        status: "update-available"
      }
    });
  });

  it("handles npm lookup failures in the version api", async () => {
    process.env.OPENGOAT_VERSION = "2026.2.9";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService()
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/version"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      version: {
        packageName: "opengoat",
        installedVersion: "2026.2.9",
        latestVersion: null,
        updateAvailable: null,
        status: "unknown",
        error: "network down"
      }
    });
  });

  it("creates agents through the api", async () => {
    const createAgent = vi.fn<OpenClawUiService["createAgent"]>(async (name: string): Promise<AgentCreationResult> => {
      return {
        agent: {
          id: "developer",
          displayName: name,
          workspaceDir: "/tmp/workspace",
          internalConfigDir: "/tmp/internal"
        },
        createdPaths: [],
        skippedPaths: []
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        createAgent
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/agents",
      payload: {
        name: "Developer",
        type: "individual",
        skills: "manager,testing"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(createAgent).toHaveBeenCalledWith("Developer", {
      type: "individual",
      reportsTo: undefined,
      skills: ["manager", "testing"]
    });
  });

  it("passes optional role when creating agents through the api", async () => {
    const createAgent = vi.fn<OpenClawUiService["createAgent"]>(async (name: string): Promise<AgentCreationResult> => {
      return {
        agent: {
          id: "developer",
          displayName: name,
          workspaceDir: "/tmp/workspace",
          internalConfigDir: "/tmp/internal"
        },
        createdPaths: [],
        skippedPaths: []
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        createAgent
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/agents",
      payload: {
        name: "Developer",
        role: "  Software Engineer  "
      }
    });

    expect(response.statusCode).toBe(200);
    expect(createAgent).toHaveBeenCalledWith("Developer", {
      type: undefined,
      reportsTo: undefined,
      skills: undefined,
      role: "Software Engineer"
    });
  });

  it("creates project session through the api", async () => {
    const prepareSession = vi.fn<NonNullable<OpenClawUiService["prepareSession"]>>(async (_agentId, options): Promise<SessionRunInfo> => {
      const sessionKey = options?.sessionRef ?? "agent:ceo:main";
      const isProject = sessionKey.startsWith("project:");
      return {
        agentId: "ceo",
        sessionKey,
        sessionId: isProject ? "project-session-1" : "workspace-session-1",
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: options?.projectPath ?? "/tmp/opengoat",
        isNewSession: !isProject
      };
    });
    const renameSession = vi.fn<NonNullable<OpenClawUiService["renameSession"]>>(async (_agentId, title = "Session", sessionRef = "agent:ceo:main"): Promise<SessionSummary> => {
      return {
        sessionKey: sessionRef,
        sessionId: sessionRef.startsWith("project:") ? "project-session-1" : "workspace-session-1",
        title,
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: "/tmp/opengoat",
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        prepareSession,
        renameSession
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/projects",
      payload: {
        folderPath: "/tmp",
        folderName: "tmp"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prepareSession).toHaveBeenCalledTimes(2);
    expect(renameSession).toHaveBeenCalledTimes(2);

    const payload = response.json() as {
      project: { name: string; path: string; sessionRef: string };
      session: { sessionKey: string };
    };
    expect(payload.project.name).toBe("tmp");
    expect(payload.project.path).toBe("/tmp");
    expect(payload.project.sessionRef.startsWith("project:")).toBe(true);
    expect(payload.session.sessionKey.startsWith("workspace:")).toBe(true);
  });

  it("bootstraps default Organization project and New Session on startup", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const listSessions = vi.fn<OpenClawUiService["listSessions"]>(async (): Promise<SessionSummary[]> => []);
    const prepareSession = vi.fn<NonNullable<OpenClawUiService["prepareSession"]>>(async (_agentId, options): Promise<SessionRunInfo> => {
      const sessionKey = options?.sessionRef ?? "agent:ceo:main";
      return {
        agentId: "ceo",
        sessionKey,
        sessionId: sessionKey.startsWith("project:") ? "project-org-1" : "workspace-org-1",
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: options?.projectPath ?? "/tmp/opengoat-home/organization",
        isNewSession: sessionKey.startsWith("workspace:")
      };
    });
    const renameSession = vi.fn<NonNullable<OpenClawUiService["renameSession"]>>(async (_agentId, title = "Session", sessionRef = "agent:ceo:main"): Promise<SessionSummary> => {
      return {
        sessionKey: sessionRef,
        sessionId: sessionRef.startsWith("project:") ? "project-org-1" : "workspace-org-1",
        title,
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: path.resolve(uniqueHomeDir, "organization"),
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService({
          homeDir: uniqueHomeDir
        }),
        listSessions,
        prepareSession,
        renameSession
      }
    });

    const organizationPath = path.resolve(uniqueHomeDir, "organization");
    expect(listSessions).toHaveBeenCalledWith("ceo");
    expect(prepareSession).toHaveBeenCalledTimes(2);
    expect(renameSession).toHaveBeenCalledTimes(2);
    expect(prepareSession).toHaveBeenNthCalledWith(
      1,
      "ceo",
      expect.objectContaining({
        sessionRef: expect.stringMatching(/^project:/),
        projectPath: organizationPath,
        forceNew: false
      })
    );
    expect(prepareSession).toHaveBeenNthCalledWith(
      2,
      "ceo",
      expect.objectContaining({
        sessionRef: expect.stringMatching(/^workspace:/),
        projectPath: organizationPath,
        forceNew: true
      })
    );
    expect(renameSession).toHaveBeenNthCalledWith(
      1,
      "ceo",
      "Organization",
      expect.stringMatching(/^project:/)
    );
    expect(renameSession).toHaveBeenNthCalledWith(
      2,
      "ceo",
      "New Session",
      expect.stringMatching(/^workspace:/)
    );
  });

  it("creates project session through legacy core fallback when prepareSession is unavailable", async () => {
    const prepareRunSession = vi.fn(async (_paths: unknown, _agentId: string, request: { sessionRef?: string; projectPath?: string }): Promise<{ enabled: true; info: SessionRunInfo }> => {
      const sessionKey = request.sessionRef ?? "agent:ceo:main";
      const isProject = sessionKey.startsWith("project:");
      return {
        enabled: true,
        info: {
          agentId: "ceo",
          sessionKey,
          sessionId: isProject ? "legacy-project-session-1" : "legacy-workspace-session-1",
          transcriptPath: "/tmp/transcript.jsonl",
          workspacePath: "/tmp/workspace",
          projectPath: request.projectPath ?? "/tmp",
          isNewSession: !isProject
        }
      };
    });

    const legacyService = {
      ...createMockService(),
      prepareSession: undefined,
      getPaths: () => {
        return { homeDir: "/tmp/opengoat-home" };
      },
      sessionService: {
        prepareRunSession
      }
    };

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: legacyService
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/projects",
      payload: {
        folderPath: "/tmp",
        folderName: "tmp"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prepareRunSession).toHaveBeenCalledTimes(2);
    const payload = response.json() as { session: { sessionKey: string } };
    expect(payload.session.sessionKey.startsWith("workspace:")).toBe(true);
  });

  it("returns unsupported for native picker on non-macos platforms", async () => {
    if (process.platform === "darwin") {
      return;
    }

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService()
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/projects/pick"
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: "Native folder picker is currently supported on macOS only."
    });
  });

  it("creates a nested workspace session and assigns a default title", async () => {
    const prepareSession = vi.fn<NonNullable<OpenClawUiService["prepareSession"]>>(async (): Promise<SessionRunInfo> => {
      return {
        agentId: "ceo",
        sessionKey: "workspace:tmp",
        sessionId: "session-2",
        transcriptPath: "/tmp/transcript-2.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: "/tmp",
        isNewSession: true
      };
    });
    const renameSession = vi.fn<NonNullable<OpenClawUiService["renameSession"]>>(async (): Promise<SessionSummary> => {
      return {
        sessionKey: "workspace:tmp",
        sessionId: "session-2",
        title: "New Session",
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript-2.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: "/tmp",
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        prepareSession,
        renameSession
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/workspaces/session",
      payload: {
        projectPath: "/tmp",
        workspaceName: "tmp"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prepareSession).toHaveBeenCalledTimes(1);
    expect(renameSession).toHaveBeenCalledTimes(1);
  });

  it("renames and removes workspace entries", async () => {
    const renameSession = vi.fn<NonNullable<OpenClawUiService["renameSession"]>>(async (): Promise<SessionSummary> => {
      return {
        sessionKey: "project:tmp",
        sessionId: "session-1",
        title: "Renamed",
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript-1.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: "/tmp",
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      };
    });
    const removeSession = vi.fn<NonNullable<OpenClawUiService["removeSession"]>>(async (): Promise<{
      sessionKey: string;
      sessionId: string;
      title: string;
      transcriptPath: string;
    }> => {
      return {
        sessionKey: "project:tmp",
        sessionId: "session-1",
        title: "tmp",
        transcriptPath: "/tmp/transcript-1.jsonl"
      };
    });
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        renameSession,
        removeSession
      }
    });

    const renameResponse = await activeServer.inject({
      method: "POST",
      url: "/api/workspaces/rename",
      payload: {
        sessionRef: "project:tmp",
        name: "Renamed"
      }
    });
    expect(renameResponse.statusCode).toBe(200);
    expect(renameSession).toHaveBeenCalledWith("ceo", "Renamed", "project:tmp");

    const deleteResponse = await activeServer.inject({
      method: "POST",
      url: "/api/workspaces/delete",
      payload: {
        sessionRef: "project:tmp"
      }
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(removeSession).toHaveBeenCalledTimes(1);
    expect(removeSession).toHaveBeenCalledWith("ceo", "project:tmp");

    const removeSessionResponse = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/remove",
      payload: {
        sessionRef: "agent:ceo:main"
      }
    });
    expect(removeSessionResponse.statusCode).toBe(200);
    expect(removeSession).toHaveBeenCalledWith("ceo", "agent:ceo:main");

    const renameSessionResponse = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/rename",
      payload: {
        sessionRef: "agent:ceo:main",
        name: "Renamed Session"
      }
    });
    expect(renameSessionResponse.statusCode).toBe(200);
    expect(renameSession).toHaveBeenCalledWith("ceo", "Renamed Session", "agent:ceo:main");
  });

  it("sends a message to an existing session", async () => {
    const runAgent = vi.fn<NonNullable<OpenClawUiService["runAgent"]>>(async (): Promise<{
      code: number;
      stdout: string;
      stderr: string;
      providerId: string;
    }> => {
      return {
        code: 0,
        stdout: "assistant response",
        stderr: "",
        providerId: "openclaw"
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        runAgent
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/message",
      payload: {
        agentId: "ceo",
        sessionRef: "workspace:tmp",
        projectPath: "/tmp",
        message: "hello"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "ceo",
      expect.objectContaining({
        message: "hello",
        sessionRef: "workspace:tmp",
        cwd: "/tmp"
      })
    );
    expect(response.json()).toMatchObject({
      output: "assistant response",
      result: {
        code: 0
      }
    });

    const aliasResponse = await activeServer.inject({
      method: "POST",
      url: "/api/session/message",
      payload: {
        agentId: "ceo",
        sessionRef: "workspace:tmp",
        projectPath: "/tmp",
        message: "hello alias"
      }
    });
    expect(aliasResponse.statusCode).toBe(200);
  });

  it("reuses stored session project path when projectPath is omitted", async () => {
    const runAgent = vi.fn<NonNullable<OpenClawUiService["runAgent"]>>(async () => {
      return {
        code: 0,
        stdout: "assistant response",
        stderr: "",
        providerId: "openclaw",
      };
    });
    const listSessions = vi.fn<NonNullable<OpenClawUiService["listSessions"]>>(async () => {
      return [
        {
          sessionKey: "workspace:tmp",
          sessionId: "session-1",
          title: "New Session",
          updatedAt: Date.now(),
          transcriptPath: "/tmp/transcript.jsonl",
          workspacePath: "/tmp/workspace",
          projectPath: "/tmp/stored-path",
          inputChars: 0,
          outputChars: 0,
          totalChars: 0,
          compactionCount: 0,
        },
      ];
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        listSessions,
        runAgent,
      },
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/message",
      payload: {
        agentId: "ceo",
        sessionRef: "workspace:tmp",
        message: "hello",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "ceo",
      expect.objectContaining({
        message: "hello",
        sessionRef: "workspace:tmp",
        cwd: "/tmp/stored-path",
      }),
    );
  });

  it("expands tilde project paths before sending session messages", async () => {
    const runAgent = vi.fn<NonNullable<OpenClawUiService["runAgent"]>>(async () => {
      return {
        code: 0,
        stdout: "assistant response",
        stderr: "",
        providerId: "openclaw",
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        runAgent,
      },
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/message",
      payload: {
        agentId: "ceo",
        sessionRef: "workspace:tmp",
        projectPath: "~/.opengoat/organization",
        message: "hello",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "ceo",
      expect.objectContaining({
        cwd: path.resolve(homedir(), ".opengoat/organization"),
      }),
    );
  });

  it("sends attached images to an existing session", async () => {
    const runAgent = vi.fn<NonNullable<OpenClawUiService["runAgent"]>>(async (): Promise<{
      code: number;
      stdout: string;
      stderr: string;
      providerId: string;
    }> => {
      return {
        code: 0,
        stdout: "assistant response",
        stderr: "",
        providerId: "openclaw"
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        runAgent
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/message",
      payload: {
        agentId: "ceo",
        sessionRef: "workspace:tmp",
        projectPath: "/tmp",
        images: [
          {
            name: "chart.png",
            mediaType: "image/png",
            dataUrl: "data:image/png;base64,Zm9v"
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "ceo",
      expect.objectContaining({
        message: "Please analyze the attached image.",
        sessionRef: "workspace:tmp",
        cwd: "/tmp",
        images: [
          {
            name: "chart.png",
            mediaType: "image/png",
            dataUrl: "data:image/png;base64,Zm9v"
          }
        ]
      })
    );
  });

  it("streams session message progress events and final result", async () => {
    const runAgent = vi.fn<
      NonNullable<OpenClawUiService["runAgent"]>
    >(async (_agentId, options) => {
      options.hooks?.onEvent?.({
        stage: "run_started",
        timestamp: "2026-02-13T00:00:00.000Z",
        runId: "run-1",
        agentId: "ceo",
      });
      options.onStdout?.("first stdout line");
      options.onStderr?.("first stderr line");
      options.hooks?.onEvent?.({
        stage: "provider_invocation_completed",
        timestamp: "2026-02-13T00:00:01.000Z",
        runId: "run-1",
        agentId: "ceo",
        providerId: "openclaw",
        code: 0,
      });

      return {
        code: 0,
        stdout: "assistant response",
        stderr: "",
        providerId: "openclaw",
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        runAgent,
      },
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/message/stream",
      payload: {
        agentId: "ceo",
        sessionRef: "workspace:tmp",
        projectPath: "/tmp",
        message: "hello",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/x-ndjson");

    const lines = response.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; phase?: string; message?: string });

    expect(lines.some((line) => line.type === "progress" && line.phase === "run_started")).toBe(true);
    expect(lines.some((line) => line.type === "progress" && line.phase === "stderr")).toBe(true);
    expect(lines.some((line) => line.type === "result")).toBe(true);
    expect(runAgent).toHaveBeenCalledWith(
      "ceo",
      expect.objectContaining({
        message: "hello",
        sessionRef: "workspace:tmp",
        cwd: "/tmp",
        hooks: expect.any(Object),
        onStderr: expect.any(Function),
      }),
    );
  });

  it("streams session messages using stored project path when projectPath is omitted", async () => {
    const runAgent = vi.fn<NonNullable<OpenClawUiService["runAgent"]>>(
      async (_agentId, options) => {
        options.hooks?.onEvent?.({
          stage: "run_started",
          timestamp: "2026-02-13T00:00:00.000Z",
          runId: "run-stored-cwd",
          agentId: "ceo",
        });

        return {
          code: 0,
          stdout: "assistant response",
          stderr: "",
          providerId: "openclaw",
        };
      },
    );
    const listSessions = vi.fn<NonNullable<OpenClawUiService["listSessions"]>>(
      async () => {
        return [
          {
            sessionKey: "workspace:tmp",
            sessionId: "session-1",
            title: "New Session",
            updatedAt: Date.now(),
            transcriptPath: "/tmp/transcript.jsonl",
            workspacePath: "/tmp/workspace",
            projectPath: "/tmp/stored-path",
            inputChars: 0,
            outputChars: 0,
            totalChars: 0,
            compactionCount: 0,
          },
        ];
      },
    );

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        listSessions,
        runAgent,
      },
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/message/stream",
      payload: {
        agentId: "ceo",
        sessionRef: "workspace:tmp",
        message: "hello",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "ceo",
      expect.objectContaining({
        message: "hello",
        sessionRef: "workspace:tmp",
        cwd: "/tmp/stored-path",
      }),
    );
  });

  it("sanitizes runtime prefixes and ansi sequences in session message output", async () => {
    const runAgent = vi.fn<NonNullable<OpenClawUiService["runAgent"]>>(async (): Promise<{
      code: number;
      stdout: string;
      stderr: string;
      providerId: string;
    }> => {
      return {
        code: 0,
        stdout:
          "\u001b[33m[agents/auth-profiles]\u001b[39m \u001b[36minherited auth-profiles from main agent\u001b[39m\n\n# Hello\nThis is **markdown**.",
        stderr: "",
        providerId: "openclaw"
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        runAgent
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/message",
      payload: {
        agentId: "ceo",
        sessionRef: "workspace:tmp",
        projectPath: "/tmp",
        message: "hello"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      output: "# Hello\nThis is **markdown**."
    });
  });

  it("returns persisted session history", async () => {
    const getSessionHistory = vi.fn<NonNullable<OpenClawUiService["getSessionHistory"]>>(async (): Promise<{
      sessionKey: string;
      sessionId: string;
      transcriptPath: string;
      messages: Array<{
        type: "message";
        role: "user" | "assistant";
        content: string;
        timestamp: number;
      }>;
    }> => {
      return {
        sessionKey: "workspace:tmp",
        sessionId: "session-1",
        transcriptPath: "/tmp/transcript.jsonl",
        messages: [
          {
            type: "message",
            role: "user",
            content: "hello",
            timestamp: 1
          },
          {
            type: "message",
            role: "assistant",
            content: "world",
            timestamp: 2
          }
        ]
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        getSessionHistory
      }
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/sessions/history?agentId=ceo&sessionRef=workspace%3Atmp&limit=50"
    });

    expect(response.statusCode).toBe(200);
    expect(getSessionHistory).toHaveBeenCalledWith("ceo", {
      sessionRef: "workspace:tmp",
      limit: 50
    });
    expect(response.json()).toMatchObject({
      sessionRef: "workspace:tmp",
      history: {
        sessionId: "session-1",
        messages: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "world" }
        ]
      }
    });
  });

  it("sanitizes persisted session history messages for ui rendering", async () => {
    const getSessionHistory = vi.fn<NonNullable<OpenClawUiService["getSessionHistory"]>>(async (): Promise<{
      sessionKey: string;
      sessionId: string;
      transcriptPath: string;
      messages: Array<{
        type: "message";
        role: "user" | "assistant";
        content: string;
        timestamp: number;
      }>;
    }> => {
      return {
        sessionKey: "workspace:tmp",
        sessionId: "session-1",
        transcriptPath: "/tmp/transcript.jsonl",
        messages: [
          {
            type: "message",
            role: "user",
            content: "hello",
            timestamp: 1
          },
          {
            type: "message",
            role: "assistant",
            content: "[33m[agents/auth-profiles] [39m [36minherited auth-profiles from main agent 39m Hey **there**",
            timestamp: 2
          }
        ]
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        getSessionHistory
      }
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/sessions/history?agentId=ceo&sessionRef=workspace%3Atmp&limit=50"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      history: {
        messages: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "Hey **there**" }
        ]
      }
    });
  });

  it("manages tasks through the api", async () => {
    const baseTask: TaskRecord = {
      taskId: "task-plan",
      createdAt: "2026-02-11T08:00:00.000Z",
      project: "~",
      owner: "ceo",
      assignedTo: "developer",
      title: "Plan roadmap",
      description: "Draft roadmap milestones",
      status: "todo",
      blockers: [],
      artifacts: [],
      worklog: []
    };
    const listTasks = vi.fn<NonNullable<OpenClawUiService["listTasks"]>>(async () => [baseTask]);
    const createTask = vi.fn<NonNullable<OpenClawUiService["createTask"]>>(async (_actorId, options) => {
      return {
        ...baseTask,
        title: options.title,
        description: options.description,
        assignedTo: options.assignedTo ?? "ceo",
        status: options.status ?? "todo",
        project: options.project ?? "~"
      };
    });
    const deleteTasks = vi.fn<NonNullable<OpenClawUiService["deleteTasks"]>>(async (_actorId, taskIds) => {
      return {
        deletedTaskIds: taskIds,
        deletedCount: taskIds.length
      };
    });
    const updateTaskStatus = vi.fn<NonNullable<OpenClawUiService["updateTaskStatus"]>>(async (_actorId, taskId, status) => {
      return {
        ...baseTask,
        taskId,
        status
      };
    });
    const addTaskBlocker = vi.fn<NonNullable<OpenClawUiService["addTaskBlocker"]>>(async (_actorId, taskId, blocker) => {
      return {
        ...baseTask,
        taskId,
        blockers: [blocker]
      };
    });
    const addTaskArtifact = vi.fn<NonNullable<OpenClawUiService["addTaskArtifact"]>>(async (_actorId, taskId, content) => {
      return {
        ...baseTask,
        taskId,
        artifacts: [
          {
            createdAt: "2026-02-11T08:02:00.000Z",
            createdBy: "developer",
            content
          }
        ]
      };
    });
    const addTaskWorklog = vi.fn<NonNullable<OpenClawUiService["addTaskWorklog"]>>(async (_actorId, taskId, content) => {
      return {
        ...baseTask,
        taskId,
        worklog: [
          {
            createdAt: "2026-02-11T08:03:00.000Z",
            createdBy: "developer",
            content
          }
        ]
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        listTasks,
        createTask,
        deleteTasks,
        updateTaskStatus,
        addTaskBlocker,
        addTaskArtifact,
        addTaskWorklog
      }
    });

    const tasksResponse = await activeServer.inject({
      method: "GET",
      url: "/api/tasks"
    });
    expect(tasksResponse.statusCode).toBe(200);
    expect(tasksResponse.json()).toMatchObject({
      tasks: [{ taskId: "task-plan" }]
    });

    const createTaskResponse = await activeServer.inject({
      method: "POST",
      url: "/api/tasks",
      payload: {
        actorId: "ceo",
        title: "Design API",
        description: "Document API contracts",
        assignedTo: "developer",
        status: "todo",
        project: "~"
      }
    });
    expect(createTaskResponse.statusCode).toBe(200);
    expect(createTask).toHaveBeenCalledWith("ceo", {
      title: "Design API",
      description: "Document API contracts",
      assignedTo: "developer",
      status: "todo",
      project: "~"
    });

    const deleteTaskResponse = await activeServer.inject({
      method: "POST",
      url: "/api/tasks/delete",
      payload: {
        actorId: "ceo",
        taskIds: ["task-plan", "task-archive"]
      }
    });
    expect(deleteTaskResponse.statusCode).toBe(200);
    expect(deleteTasks).toHaveBeenCalledWith("ceo", ["task-plan", "task-archive"]);

    const statusResponse = await activeServer.inject({
      method: "POST",
      url: "/api/tasks/task-plan/status",
      payload: {
        actorId: "developer",
        status: "doing"
      }
    });
    expect(statusResponse.statusCode).toBe(200);
    expect(updateTaskStatus).toHaveBeenCalledWith("developer", "task-plan", "doing", undefined);

    const blockerResponse = await activeServer.inject({
      method: "POST",
      url: "/api/tasks/task-plan/blocker",
      payload: {
        actorId: "developer",
        content: "Waiting for schema"
      }
    });
    expect(blockerResponse.statusCode).toBe(200);
    expect(addTaskBlocker).toHaveBeenCalledWith("developer", "task-plan", "Waiting for schema");

    const artifactResponse = await activeServer.inject({
      method: "POST",
      url: "/api/tasks/task-plan/artifact",
      payload: {
        actorId: "developer",
        content: "https://example.com/spec"
      }
    });
    expect(artifactResponse.statusCode).toBe(200);
    expect(addTaskArtifact).toHaveBeenCalledWith("developer", "task-plan", "https://example.com/spec");

    const worklogResponse = await activeServer.inject({
      method: "POST",
      url: "/api/tasks/task-plan/worklog",
      payload: {
        actorId: "developer",
        content: "Initial draft complete"
      }
    });
    expect(worklogResponse.statusCode).toBe(200);
    expect(addTaskWorklog).toHaveBeenCalledWith("developer", "task-plan", "Initial draft complete");
  });
});

function createMockService(options: { homeDir?: string } = {}): OpenClawUiService {
  const homeDir = options.homeDir ?? "/tmp/opengoat-home";
  const organizationPath = path.resolve(homeDir, "organization");
  return {
    initialize: async () => {
      return undefined;
    },
    getHomeDir: () => homeDir,
    listAgents: async (): Promise<AgentDescriptor[]> => [],
    createAgent: async (name: string): Promise<AgentCreationResult> => {
      return {
        agent: {
          id: name.toLowerCase(),
          displayName: name,
          workspaceDir: "/tmp/workspace",
          internalConfigDir: "/tmp/internal"
        },
        createdPaths: [],
        skippedPaths: []
      };
    },
    deleteAgent: async (agentId: string): Promise<AgentDeletionResult> => {
      return {
        agentId,
        existed: true,
        removedPaths: [],
        skippedPaths: []
      };
    },
    listSessions: async (): Promise<SessionSummary[]> => [
      {
        sessionKey: "project:organization-default",
        sessionId: "session-project-organization",
        title: "Organization",
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript-project.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: organizationPath,
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      },
      {
        sessionKey: "workspace:organization-default",
        sessionId: "session-workspace-organization",
        title: "New Session",
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript-workspace.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: organizationPath,
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      }
    ],
    listSkills: async (): Promise<ResolvedSkill[]> => [],
    listGlobalSkills: async (): Promise<ResolvedSkill[]> => [],
    renameSession: async (_agentId, title = "Session", sessionRef = "agent:ceo:main"): Promise<SessionSummary> => {
      return {
        sessionKey: sessionRef,
        sessionId: "session-1",
        title,
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: "/tmp",
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      };
    },
    removeSession: async (_agentId, sessionRef = "agent:ceo:main"): Promise<{
      sessionKey: string;
      sessionId: string;
      title: string;
      transcriptPath: string;
    }> => {
      return {
        sessionKey: sessionRef,
        sessionId: "session-1",
        title: "Session",
        transcriptPath: "/tmp/transcript.jsonl"
      };
    },
    prepareSession: async (): Promise<SessionRunInfo> => {
      return {
        agentId: "ceo",
        sessionKey: "agent:ceo:main",
        sessionId: "session-1",
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        projectPath: "/tmp",
        isNewSession: true
      };
    },
    runAgent: async (): Promise<{
      code: number;
      stdout: string;
      stderr: string;
      providerId: string;
    }> => {
      return {
        code: 0,
        stdout: "ok",
        stderr: "",
        providerId: "openclaw"
      };
    }
  };
}
