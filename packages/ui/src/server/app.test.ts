import { mkdir, readFile, writeFile } from "node:fs/promises";
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
        taskCronEnabled: true,
        notifyManagersOfInactiveAgents: true,
        maxInactivityMinutes: 30,
        maxParallelFlows: 3,
        inactiveAgentNotificationTarget: "all-managers",
        ceoBootstrapPending: false,
      },
    });

    const updateResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      payload: {
        taskCronEnabled: false,
        notifyManagersOfInactiveAgents: false,
        maxInactivityMinutes: 45,
        maxParallelFlows: 6,
        inactiveAgentNotificationTarget: "ceo-only",
      },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      settings: {
        taskCronEnabled: false,
        notifyManagersOfInactiveAgents: false,
        maxInactivityMinutes: 45,
        maxParallelFlows: 6,
        inactiveAgentNotificationTarget: "ceo-only",
        ceoBootstrapPending: false,
      },
    });

    const automationOnlyResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      payload: {
        taskCronEnabled: true,
        notifyManagersOfInactiveAgents: false,
        maxInactivityMinutes: 45,
        maxParallelFlows: 6,
        inactiveAgentNotificationTarget: "ceo-only",
      },
    });
    expect(automationOnlyResponse.statusCode).toBe(200);
    expect(automationOnlyResponse.json()).toMatchObject({
      settings: {
        taskCronEnabled: true,
        notifyManagersOfInactiveAgents: false,
        maxInactivityMinutes: 45,
        maxParallelFlows: 6,
        inactiveAgentNotificationTarget: "ceo-only",
        ceoBootstrapPending: false,
      },
    });

    const updatedResponse = await activeServer.inject({
      method: "GET",
      url: "/api/settings"
    });
    expect(updatedResponse.statusCode).toBe(200);
    expect(updatedResponse.json()).toMatchObject({
      settings: {
        taskCronEnabled: true,
        notifyManagersOfInactiveAgents: false,
        maxInactivityMinutes: 45,
        maxParallelFlows: 6,
        inactiveAgentNotificationTarget: "ceo-only",
        ceoBootstrapPending: false,
      },
    });
  });

  it("protects API routes with username/password authentication when enabled", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService({
        homeDir: uniqueHomeDir,
      }),
    });

    const enableAuthResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      payload: {
        authentication: {
          enabled: true,
          username: "admin.user",
          password: "StrongPassphrase#2026",
        },
      },
    });
    expect(enableAuthResponse.statusCode).toBe(200);

    const settingsFile = await readFile(
      `${uniqueHomeDir}/ui-settings.json`,
      "utf8",
    );
    expect(settingsFile).toContain("\"passwordHash\"");
    expect(settingsFile).not.toContain("StrongPassphrase#2026");

    const blockedAgentsResponse = await activeServer.inject({
      method: "GET",
      url: "/api/agents",
    });
    expect(blockedAgentsResponse.statusCode).toBe(401);
    expect(blockedAgentsResponse.json()).toMatchObject({
      code: "AUTH_REQUIRED",
    });

    const failedLoginResponse = await activeServer.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "admin.user",
        password: "wrong-password",
      },
    });
    expect(failedLoginResponse.statusCode).toBe(401);

    const loginResponse = await activeServer.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "admin.user",
        password: "StrongPassphrase#2026",
      },
    });
    expect(loginResponse.statusCode).toBe(200);
    const authCookie = extractCookieHeader(loginResponse);
    expect(authCookie).toBeTruthy();

    const allowedAgentsResponse = await activeServer.inject({
      method: "GET",
      url: "/api/agents",
      headers: {
        cookie: authCookie,
      },
    });
    expect(allowedAgentsResponse.statusCode).toBe(200);
    expect(allowedAgentsResponse.json()).toMatchObject({
      agents: [],
    });
  });

  it("rate limits repeated failed sign-in attempts", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService({
        homeDir: uniqueHomeDir,
      }),
    });

    const enableAuthResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      payload: {
        authentication: {
          enabled: true,
          username: "security",
          password: "StrongPassphrase#2026",
        },
      },
    });
    expect(enableAuthResponse.statusCode).toBe(200);

    let lastStatusCode = 0;
    for (let index = 0; index < 5; index += 1) {
      const loginResponse = await activeServer.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          username: "security",
          password: "not-correct",
        },
      });
      lastStatusCode = loginResponse.statusCode;
    }

    expect(lastStatusCode).toBe(429);
  });

  it("requires current password before changing existing authentication settings", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService({
        homeDir: uniqueHomeDir,
      }),
    });

    const enableAuthResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      payload: {
        authentication: {
          enabled: true,
          username: "ops",
          password: "StrongPassphrase#2026",
        },
      },
    });
    expect(enableAuthResponse.statusCode).toBe(200);

    const loginResponse = await activeServer.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "ops",
        password: "StrongPassphrase#2026",
      },
    });
    expect(loginResponse.statusCode).toBe(200);
    const authCookie = extractCookieHeader(loginResponse);
    expect(authCookie).toBeTruthy();

    const missingCurrentPasswordResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      headers: {
        cookie: authCookie,
      },
      payload: {
        authentication: {
          enabled: false,
        },
      },
    });
    expect(missingCurrentPasswordResponse.statusCode).toBe(400);

    const wrongCurrentPasswordResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      headers: {
        cookie: authCookie,
      },
      payload: {
        authentication: {
          enabled: false,
          currentPassword: "wrong-password",
        },
      },
    });
    expect(wrongCurrentPasswordResponse.statusCode).toBe(401);

    const disableAuthResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      headers: {
        cookie: authCookie,
      },
      payload: {
        authentication: {
          enabled: false,
          currentPassword: "StrongPassphrase#2026",
        },
      },
    });
    expect(disableAuthResponse.statusCode).toBe(200);
    expect(disableAuthResponse.json()).toMatchObject({
      settings: {
        authentication: {
          enabled: false,
        },
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
          taskCronEnabled: false,
          notifyManagersOfInactiveAgents: false,
          maxInactivityMinutes: 30,
          maxParallelFlows: 4,
          inactiveAgentNotificationTarget: "ceo-only",
        }, null, 2)}\n`,
        "utf8"
      );

      await vi.advanceTimersByTimeAsync(60_000);
      expect(runTaskCronCycle).toHaveBeenCalledTimes(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("logs per-dispatch task-cron delivery messages", async () => {
    vi.useFakeTimers();
    try {
      const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const runTaskCronCycle = vi.fn<NonNullable<OpenClawUiService["runTaskCronCycle"]>>(async () => {
        return {
          ranAt: new Date().toISOString(),
          scannedTasks: 1,
          todoTasks: 0,
          blockedTasks: 0,
          inactiveAgents: 1,
          sent: 1,
          failed: 0,
          dispatches: [
            {
              kind: "inactive",
              targetAgentId: "ceo",
              sessionRef: "agent:ceo:agent_ceo_inactive_engineer",
              subjectAgentId: "engineer",
              message:
                'Your reportee "@engineer" (Engineer) has no activity in the last 30 minutes.',
              ok: true,
            },
          ],
        };
      });

      activeServer = await createOpenGoatUiServer({
        logger: false,
        attachFrontend: false,
        service: {
          ...createMockService({
            homeDir: uniqueHomeDir,
          }),
          runTaskCronCycle,
        },
      });

      await vi.advanceTimersByTimeAsync(60_000);
      expect(runTaskCronCycle).toHaveBeenCalledTimes(1);

      const logsResponse = await activeServer.inject({
        method: "GET",
        url: "/api/logs/stream?follow=false&limit=200",
      });
      expect(logsResponse.statusCode).toBe(200);
      const snapshotEvent = logsResponse.body
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { type: string; entries?: Array<{ message?: string }> })
        .find((event) => event.type === "snapshot");
      const messages =
        snapshotEvent?.entries
          ?.map((entry) => entry.message ?? "")
          .filter(Boolean) ?? [];
      expect(
        messages.some((entry) =>
          entry.includes("[task-cron] Agent @ceo received inactive message."),
        ),
      ).toBe(true);
      expect(
        messages.some((entry) =>
          entry.includes(
            "message=\"Your reportee '@engineer' (Engineer) has no activity in the last 30 minutes.\"",
          ),
        ),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps scheduler paused while ceo bootstrap is pending", async () => {
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
          failed: 0,
        };
      });

      await mkdir(path.resolve(uniqueHomeDir, "workspaces", "ceo"), {
        recursive: true,
      });
      await writeFile(
        path.resolve(uniqueHomeDir, "workspaces", "ceo", "BOOTSTRAP.md"),
        "# BOOTSTRAP.md\n",
        "utf8",
      );

      activeServer = await createOpenGoatUiServer({
        logger: false,
        attachFrontend: false,
        service: {
          ...createMockService({
            homeDir: uniqueHomeDir,
          }),
          runTaskCronCycle,
        },
      });

      const settingsResponse = await activeServer.inject({
        method: "GET",
        url: "/api/settings",
      });
      expect(settingsResponse.statusCode).toBe(200);
      expect(settingsResponse.json()).toMatchObject({
        settings: {
          ceoBootstrapPending: true,
        },
      });

      await vi.advanceTimersByTimeAsync(60_000);
      expect(runTaskCronCycle).toHaveBeenCalledTimes(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps legacy taskCronEnabled setting to cron and notifications", async () => {
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
        taskCronEnabled: false,
        notifyManagersOfInactiveAgents: false,
        maxInactivityMinutes: 30,
        maxParallelFlows: 3,
        inactiveAgentNotificationTarget: "all-managers",
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

  it("assigns the provider when creating non-openclaw agents through the api", async () => {
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
    const setAgentProvider = vi.fn<NonNullable<OpenClawUiService["setAgentProvider"]>>(async (agentId, providerId) => {
      return {
        agentId,
        providerId
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        createAgent,
        setAgentProvider
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/agents",
      payload: {
        name: "Developer",
        providerId: "claude-code"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(setAgentProvider).toHaveBeenCalledWith("developer", "claude-code");
  });

  it("assigns providers from the runtime registry when creating agents", async () => {
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
    const setAgentProvider = vi.fn<NonNullable<OpenClawUiService["setAgentProvider"]>>(async (agentId, providerId) => {
      return {
        agentId,
        providerId
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        createAgent,
        setAgentProvider,
        listProviders: async () => [
          {
            id: "openclaw",
            displayName: "OpenClaw",
            kind: "cli",
            capabilities: {
              agent: true,
              model: false,
              auth: false,
              passthrough: true,
              reportees: true
            }
          },
          {
            id: "codecs",
            displayName: "Codecs",
            kind: "cli",
            capabilities: {
              agent: true,
              model: true,
              auth: true,
              passthrough: true,
              reportees: false
            }
          }
        ]
      }
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/agents",
      payload: {
        name: "Developer",
        providerId: "codecs"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(setAgentProvider).toHaveBeenCalledWith("developer", "codecs");
  });

  it("rejects unsupported provider ids when creating agents through the api", async () => {
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
        providerId: "invalid-provider"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(createAgent).not.toHaveBeenCalled();
    expect(response.json()).toEqual({
      error: "providerId must be one of: openclaw, claude-code, codex"
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
        sessionId: "workspace-org-1",
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        isNewSession: true
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

    expect(listSessions).toHaveBeenCalledWith("ceo");
    expect(prepareSession).toHaveBeenCalledTimes(1);
    expect(renameSession).toHaveBeenCalledTimes(1);
    expect(prepareSession).toHaveBeenNthCalledWith(
      1,
      "ceo",
      expect.objectContaining({
        sessionRef: expect.stringMatching(/^workspace:/),
        forceNew: true
      })
    );
    expect(renameSession).toHaveBeenNthCalledWith(
      1,
      "ceo",
      "New Session",
      expect.stringMatching(/^workspace:/)
    );
  });

  it("creates project session through legacy core fallback when prepareSession is unavailable", async () => {
    const prepareRunSession = vi.fn(async (_paths: unknown, _agentId: string, request: { sessionRef?: string }): Promise<{ enabled: true; info: SessionRunInfo }> => {
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
        workspaceName: "tmp"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prepareSession).toHaveBeenCalledTimes(1);
    expect(renameSession).toHaveBeenCalledTimes(1);
  });

  it("resolves wiki pages recursively and prefers index.md overlaps", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const wikiRoot = path.resolve(uniqueHomeDir, "organization", "wiki");
    await mkdir(path.resolve(wikiRoot, "foo"), { recursive: true });
    await writeFile(
      path.resolve(wikiRoot, "index.md"),
      "# Root Wiki\n\nWelcome.",
      "utf8",
    );
    await writeFile(
      path.resolve(wikiRoot, "foo.md"),
      "# Should Not Win\n",
      "utf8",
    );
    await writeFile(
      path.resolve(wikiRoot, "foo", "index.md"),
      "# Nested Index\n",
      "utf8",
    );
    await writeFile(
      path.resolve(wikiRoot, "foo", "bar.md"),
      "# Bar Page\n",
      "utf8",
    );

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService({
        homeDir: uniqueHomeDir,
      }),
    });

    const rootResponse = await activeServer.inject({
      method: "GET",
      url: "/api/wiki/page",
    });
    expect(rootResponse.statusCode).toBe(200);
    expect(rootResponse.json()).toMatchObject({
      page: {
        path: "",
        title: "Root Wiki",
        sourcePath: path.resolve(wikiRoot, "index.md"),
      },
    });
    const rootPayload = rootResponse.json() as {
      pages: Array<{ path: string; sourcePath: string }>;
    };
    const fooPage = rootPayload.pages.find((page) => page.path === "foo");
    expect(fooPage).toMatchObject({
      path: "foo",
      sourcePath: path.resolve(wikiRoot, "foo", "index.md"),
    });

    const nestedResponse = await activeServer.inject({
      method: "GET",
      url: "/api/wiki/page?path=foo%2Fbar",
    });
    expect(nestedResponse.statusCode).toBe(200);
    expect(nestedResponse.json()).toMatchObject({
      page: {
        path: "foo/bar",
        title: "Bar Page",
        sourcePath: path.resolve(wikiRoot, "foo", "bar.md"),
      },
    });

    const updateResponse = await activeServer.inject({
      method: "POST",
      url: "/api/wiki/page",
      payload: {
        path: "foo/bar",
        content: "# Bar Updated\n\nBody",
      },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      page: {
        path: "foo/bar",
        title: "Bar Updated",
      },
    });
    const updated = await readFile(path.resolve(wikiRoot, "foo", "bar.md"), "utf8");
    expect(updated).toBe("# Bar Updated\n\nBody");

    const deleteResponse = await activeServer.inject({
      method: "DELETE",
      url: "/api/wiki/page?path=foo%2Fbar",
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.json()).toMatchObject({
      deletedPath: "foo/bar",
      requestedPath: "foo/bar",
    });
    await expect(
      readFile(path.resolve(wikiRoot, "foo", "bar.md"), "utf8"),
    ).rejects.toThrow();

    const deleteFallbackResponse = await activeServer.inject({
      method: "DELETE",
      url: "/api/wiki/page?path=foo",
    });
    expect(deleteFallbackResponse.statusCode).toBe(200);
    expect(deleteFallbackResponse.json()).toMatchObject({
      deletedPath: "foo",
      requestedPath: "foo",
    });

    const afterFallbackDelete = await activeServer.inject({
      method: "GET",
      url: "/api/wiki/page?path=foo",
    });
    expect(afterFallbackDelete.statusCode).toBe(200);
    expect(afterFallbackDelete.json()).toMatchObject({
      page: {
        path: "foo",
        title: "Should Not Win",
        sourcePath: path.resolve(wikiRoot, "foo.md"),
      },
    });
  });

  it("returns 404 when a wiki page path is missing", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const wikiRoot = path.resolve(uniqueHomeDir, "organization", "wiki");
    await mkdir(wikiRoot, { recursive: true });
    await writeFile(path.resolve(wikiRoot, "index.md"), "# Root Wiki", "utf8");

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService({
        homeDir: uniqueHomeDir,
      }),
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/wiki/page?path=missing-page",
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: 'Wiki page not found for path "missing-page".',
    });

    const deleteResponse = await activeServer.inject({
      method: "DELETE",
      url: "/api/wiki/page?path=missing-page",
    });
    expect(deleteResponse.statusCode).toBe(404);
    expect(deleteResponse.json()).toMatchObject({
      error: 'Wiki page not found for path "missing-page".',
    });
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
        message: "hello"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "ceo",
      expect.objectContaining({
        message: "hello",
        sessionRef: "workspace:tmp"
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
        message: "hello alias"
      }
    });
    expect(aliasResponse.statusCode).toBe(200);
  });

  it("logs incoming session message previews to the logs stream", async () => {
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
        message: 'review "alpha" release',
      },
    });
    expect(response.statusCode).toBe(200);

    const logsResponse = await activeServer.inject({
      method: "GET",
      url: "/api/logs/stream?follow=false&limit=50",
    });
    expect(logsResponse.statusCode).toBe(200);
    const snapshotEvent = logsResponse.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; entries?: Array<{ message?: string }> })
      .find((event) => event.type === "snapshot");
    const messages =
      snapshotEvent?.entries
        ?.map((entry) => entry.message ?? "")
        .filter(Boolean) ?? [];
    expect(
      messages.some((entry) =>
        entry.includes(
          `Agent @ceo received message: "review 'alpha' release" (session=workspace:tmp).`,
        ),
      ),
    ).toBe(true);
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
        hooks: expect.any(Object),
        onStderr: expect.any(Function),
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

function extractCookieHeader(response: { headers: Record<string, unknown> }): string {
  const headerValue = response.headers["set-cookie"];
  if (Array.isArray(headerValue)) {
    const first = headerValue[0];
    if (typeof first === "string") {
      return first.split(";")[0] ?? "";
    }
  }
  if (typeof headerValue === "string") {
    return headerValue.split(";")[0] ?? "";
  }
  return "";
}

function createMockService(options: { homeDir?: string } = {}): OpenClawUiService {
  const homeDir = options.homeDir ?? "/tmp/opengoat-home";
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
        sessionId: "session-organization",
        title: "Organization",
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript-project.jsonl",
        workspacePath: "/tmp/workspace",
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
        inputChars: 0,
        outputChars: 0,
        totalChars: 0,
        compactionCount: 0
      }
    ],
    listSkills: async (): Promise<ResolvedSkill[]> => [],
    listGlobalSkills: async (): Promise<ResolvedSkill[]> => [],
    listProviders: async () => [
      {
        id: "openclaw",
        displayName: "OpenClaw",
        kind: "cli",
        capabilities: {
          agent: true,
          model: false,
          auth: false,
          passthrough: true,
          reportees: true
        }
      },
      {
        id: "claude-code",
        displayName: "Claude Code",
        kind: "cli",
        capabilities: {
          agent: true,
          model: true,
          auth: true,
          passthrough: true,
          reportees: false
        }
      },
      {
        id: "codex",
        displayName: "Codex",
        kind: "cli",
        capabilities: {
          agent: true,
          model: true,
          auth: true,
          passthrough: true,
          reportees: false
        }
      }
    ],
    renameSession: async (_agentId, title = "Session", sessionRef = "agent:ceo:main"): Promise<SessionSummary> => {
      return {
        sessionKey: sessionRef,
        sessionId: "session-1",
        title,
        updatedAt: Date.now(),
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
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
