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
  updatedAt: string;
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

  it("returns first-run onboarding status when OpenClaw gateway is running", async () => {
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService({
        agents: [],
        runOpenClaw: async (args) => {
          if (args[0] === "--version") {
            return {
              code: 0,
              stdout: "openclaw 1.6.2\n",
              stderr: "",
            };
          }
          return {
            code: 0,
            stdout: JSON.stringify({
              port: {
                status: "listening",
              },
            }),
            stderr: "",
          };
        },
      }),
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/openclaw/onboarding",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      onboarding: {
        shouldShow: true,
        hasCeoAgent: false,
        ceoBootstrapPending: false,
        gateway: {
          installed: true,
          gatewayRunning: true,
          version: "1.6.2",
          installCommand: "npm i -g openclaw@latest",
        },
      },
    });
  });

  it("returns install guidance when OpenClaw is missing", async () => {
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService({
        agents: [],
        runOpenClaw: async () => {
          const error = new Error("spawn openclaw ENOENT");
          (error as NodeJS.ErrnoException).code = "ENOENT";
          throw error;
        },
      }),
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/openclaw/onboarding",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      onboarding: {
        shouldShow: true,
        gateway: {
          installed: false,
          gatewayRunning: false,
          installCommand: "npm i -g openclaw@latest",
          startCommand: "openclaw gateway --allow-unconfigured",
        },
      },
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
        maxParallelFlows: 3,
        taskDelegationStrategies: {
          topDown: {
            enabled: true,
            openTasksThreshold: 5,
          },
          bottomUp: {
            enabled: false,
            maxInactivityMinutes: 30,
            inactiveAgentNotificationTarget: "all-managers",
          },
        },
        ceoBootstrapPending: false,
      },
    });

    const updateResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      payload: {
        taskCronEnabled: false,
        taskDelegationStrategies: {
          topDown: {
            enabled: true,
            openTasksThreshold: 5,
          },
          bottomUp: {
            enabled: false,
            maxInactivityMinutes: 45,
            inactiveAgentNotificationTarget: "goat-only",
          },
        },
        maxParallelFlows: 6,
      },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      settings: {
        taskCronEnabled: false,
        maxParallelFlows: 6,
        taskDelegationStrategies: {
          bottomUp: {
            enabled: false,
            maxInactivityMinutes: 45,
            inactiveAgentNotificationTarget: "goat-only",
          },
        },
        ceoBootstrapPending: false,
      },
    });

    const automationOnlyResponse = await activeServer.inject({
      method: "POST",
      url: "/api/settings",
      payload: {
        taskCronEnabled: true,
        taskDelegationStrategies: {
          topDown: {
            enabled: true,
            openTasksThreshold: 5,
          },
          bottomUp: {
            enabled: false,
            maxInactivityMinutes: 45,
            inactiveAgentNotificationTarget: "goat-only",
          },
        },
        maxParallelFlows: 6,
      },
    });
    expect(automationOnlyResponse.statusCode).toBe(200);
    expect(automationOnlyResponse.json()).toMatchObject({
      settings: {
        taskCronEnabled: true,
        maxParallelFlows: 6,
        taskDelegationStrategies: {
          topDown: {
            enabled: true,
            openTasksThreshold: 5,
          },
          bottomUp: {
            enabled: false,
            maxInactivityMinutes: 45,
            inactiveAgentNotificationTarget: "goat-only",
          },
        },
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
        maxParallelFlows: 6,
        taskDelegationStrategies: {
          bottomUp: {
            enabled: false,
            maxInactivityMinutes: 45,
            inactiveAgentNotificationTarget: "goat-only",
          },
        },
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

  it("isolates failed sign-in rate limits per forwarded client ip behind trusted proxies", async () => {
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

    for (let index = 0; index < 5; index += 1) {
      await activeServer.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: "127.0.0.1",
        headers: {
          "x-forwarded-for": "198.51.100.70",
        },
        payload: {
          username: "security",
          password: "wrong-password",
        },
      });
    }

    const blockedResponse = await activeServer.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "127.0.0.1",
      headers: {
        "x-forwarded-for": "198.51.100.70",
      },
      payload: {
        username: "security",
        password: "wrong-password",
      },
    });
    expect(blockedResponse.statusCode).toBe(429);

    const independentClientResponse = await activeServer.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "127.0.0.1",
      headers: {
        "x-forwarded-for": "198.51.100.71",
      },
      payload: {
        username: "security",
        password: "wrong-password",
      },
    });
    expect(independentClientResponse.statusCode).toBe(401);
  });

  it("does not reset failed sign-in attempts when logout is called unauthenticated", async () => {
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

    for (let index = 0; index < 4; index += 1) {
      const loginResponse = await activeServer.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: "198.51.100.23",
        payload: {
          username: "security",
          password: "not-correct",
        },
      });
      expect(loginResponse.statusCode).toBe(401);
    }

    const logoutResponse = await activeServer.inject({
      method: "POST",
      url: "/api/auth/logout",
      remoteAddress: "198.51.100.23",
    });
    expect(logoutResponse.statusCode).toBe(200);

    const limitedResponse = await activeServer.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "198.51.100.23",
      payload: {
        username: "security",
        password: "not-correct",
      },
    });
    expect(limitedResponse.statusCode).toBe(429);
  });

  it("rejects spoofed forwarded-proto headers from untrusted clients", async () => {
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

    const loginResponse = await activeServer.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "198.51.100.24",
      headers: {
        host: "opengoat.example.com",
        "x-forwarded-proto": "https",
      },
      payload: {
        username: "admin.user",
        password: "StrongPassphrase#2026",
      },
    });
    expect(loginResponse.statusCode).toBe(400);
    expect(loginResponse.json()).toMatchObject({
      code: "AUTH_SESSION_ISSUE_FAILED",
    });
  });

  it("accepts forwarded-proto from loopback proxies for HTTPS deployment setups", async () => {
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

    const loginResponse = await activeServer.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "127.0.0.1",
      headers: {
        host: "opengoat.example.com",
        "x-forwarded-proto": "https",
      },
      payload: {
        username: "admin.user",
        password: "StrongPassphrase#2026",
      },
    });
    expect(loginResponse.statusCode).toBe(200);
    expect(extractCookieHeader(loginResponse)).toContain("opengoat_ui_session=");
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
          doingTasks: 0,
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
          taskDelegationStrategies: {
            bottomUp: {
              enabled: false,
              maxInactivityMinutes: 30,
              inactiveAgentNotificationTarget: "goat-only",
            },
          },
          maxParallelFlows: 4,
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
          doingTasks: 0,
          blockedTasks: 0,
          inactiveAgents: 1,
          sent: 1,
          failed: 0,
          dispatches: [
            {
              kind: "inactive",
              targetAgentId: "goat",
              sessionRef: "agent:goat:agent_goat_inactive_engineer",
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
          entry.includes("[task-cron] Agent @goat received inactive message."),
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

  it("keeps scheduler paused while goat bootstrap is pending", async () => {
    vi.useFakeTimers();
    try {
      const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const runTaskCronCycle = vi.fn<NonNullable<OpenClawUiService["runTaskCronCycle"]>>(async () => {
        return {
          ranAt: new Date().toISOString(),
          scannedTasks: 0,
          todoTasks: 0,
          doingTasks: 0,
          blockedTasks: 0,
          inactiveAgents: 0,
          sent: 0,
          failed: 0,
        };
      });

      await mkdir(path.resolve(uniqueHomeDir, "workspaces", "goat"), {
        recursive: true,
      });
      await writeFile(
        path.resolve(uniqueHomeDir, "workspaces", "goat", "BOOTSTRAP.md"),
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
        maxParallelFlows: 3,
        taskDelegationStrategies: {
          topDown: {
            enabled: true,
            openTasksThreshold: 5,
          },
          bottomUp: {
            enabled: false,
            maxInactivityMinutes: 30,
            inactiveAgentNotificationTarget: "all-managers",
          },
        },
      },
    });
  });

  it("installs skills through the API and forwards install options", async () => {
    const installSkill = vi.fn<
      NonNullable<OpenClawUiService["installSkill"]>
    >(async () => {
      return {
        scope: "global",
        skillId: "frontend-design",
        skillName: "frontend-design",
        source: "source-url",
        installedPath: "/tmp/opengoat/skills/frontend-design/SKILL.md",
        assignedAgentIds: ["goat", "developer"],
        workspaceInstallPaths: [
          "/tmp/workspaces/goat/skills/frontend-design/SKILL.md",
          "/tmp/workspaces/developer/.agents/skills/frontend-design/SKILL.md",
        ],
        replaced: false,
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        installSkill,
      },
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/skills/install",
      payload: {
        scope: "global",
        sourceUrl: "https://github.com/anthropics/skills",
        sourceSkillName: "frontend-design",
        assignToAllAgents: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(installSkill).toHaveBeenCalledWith({
      scope: "global",
      agentId: undefined,
      skillName: "frontend-design",
      sourcePath: undefined,
      sourceUrl: "https://github.com/anthropics/skills",
      sourceSkillName: "frontend-design",
      description: undefined,
      assignToAllAgents: true,
    });
    expect(response.json()).toMatchObject({
      result: {
        skillId: "frontend-design",
        scope: "global",
      },
    });
  });

  it("validates skills install payload for conflicting sources", async () => {
    const installSkill = vi.fn<
      NonNullable<OpenClawUiService["installSkill"]>
    >(async () => {
      return {
        scope: "agent",
        agentId: "goat",
        skillId: "frontend-design",
        skillName: "frontend-design",
        source: "source-path",
        installedPath: "/tmp/opengoat/skills/frontend-design/SKILL.md",
        replaced: false,
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        installSkill,
      },
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/skills/install",
      payload: {
        scope: "agent",
        agentId: "goat",
        skillName: "frontend-design",
        sourcePath: "/tmp/source",
        sourceUrl: "https://github.com/anthropics/skills",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Use either sourcePath or sourceUrl, not both.",
    });
    expect(installSkill).not.toHaveBeenCalled();
  });

  it("removes skills through the API and forwards remove options", async () => {
    const removeSkill = vi.fn<
      NonNullable<OpenClawUiService["removeSkill"]>
    >(async () => {
      return {
        scope: "global",
        skillId: "frontend-design",
        removedFromGlobal: true,
        removedFromAgentIds: ["goat", "developer"],
        removedWorkspacePaths: [
          "/tmp/workspaces/goat/skills/frontend-design/SKILL.md",
          "/tmp/workspaces/developer/.agents/skills/frontend-design/SKILL.md",
        ],
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        removeSkill,
      },
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/skills/remove",
      payload: {
        scope: "global",
        skillId: "frontend-design",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(removeSkill).toHaveBeenCalledWith({
      scope: "global",
      agentId: undefined,
      skillId: "frontend-design",
    });
    expect(response.json()).toMatchObject({
      result: {
        skillId: "frontend-design",
        scope: "global",
      },
    });
  });

  it("validates skill remove payload when skillId is missing", async () => {
    const removeSkill = vi.fn<
      NonNullable<OpenClawUiService["removeSkill"]>
    >(async () => {
      return {
        scope: "agent",
        agentId: "goat",
        skillId: "frontend-design",
        removedFromGlobal: false,
        removedFromAgentIds: ["goat"],
        removedWorkspacePaths: [],
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        removeSkill,
      },
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/skills/remove",
      payload: {
        scope: "agent",
        agentId: "goat",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "skillId is required.",
    });
    expect(removeSkill).not.toHaveBeenCalled();
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

  it("returns a normalized agent profile through the api", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const developerConfigDir = path.resolve(uniqueHomeDir, "agents", "developer");
    await mkdir(developerConfigDir, { recursive: true });
    await writeFile(
      path.resolve(developerConfigDir, "config.json"),
      JSON.stringify(
        {
          id: "developer",
          displayName: "Developer",
          role: "Software Engineer",
          description: "Builds features.",
          organization: {
            type: "individual",
            reportsTo: "goat",
            discoverable: false,
            tags: ["frontend", "ux"],
            priority: 65,
          },
          runtime: {
            provider: { id: "codex" },
            skills: {
              assigned: ["react", "typescript"],
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService({ homeDir: uniqueHomeDir }),
        listAgents: async (): Promise<AgentDescriptor[]> => [
          {
            id: "goat",
            displayName: "Goat",
            workspaceDir: "/tmp/workspaces/goat",
            internalConfigDir: path.resolve(uniqueHomeDir, "agents", "goat"),
          },
          {
            id: "developer",
            displayName: "Developer",
            workspaceDir: "/tmp/workspaces/developer",
            internalConfigDir: developerConfigDir,
          },
        ],
      },
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/agents/developer",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      agent: {
        id: "developer",
        displayName: "Developer",
        type: "individual",
        reportsTo: "goat",
        role: "Software Engineer",
        description: "Builds features.",
        discoverable: false,
        tags: ["frontend", "ux"],
        priority: 65,
        providerId: "codex",
        skills: ["react", "typescript"],
      },
    });
  });

  it("loads agent profiles even when route casing differs from stored agent id", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const ceoConfigDir = path.resolve(uniqueHomeDir, "agents", "Goat");
    await mkdir(ceoConfigDir, { recursive: true });
    await writeFile(
      path.resolve(ceoConfigDir, "config.json"),
      JSON.stringify(
        {
          id: "Goat",
          displayName: "Goat",
          role: "Chief Executive Officer",
          description: "Leads the organization.",
          organization: {
            type: "manager",
            reportsTo: null,
            discoverable: true,
            tags: ["leadership"],
            priority: 100,
          },
          runtime: {
            provider: { id: "openclaw" },
            skills: { assigned: ["og-boards"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService({ homeDir: uniqueHomeDir }),
        listAgents: async (): Promise<AgentDescriptor[]> => [
          {
            id: "Goat",
            displayName: "Goat",
            workspaceDir: "/tmp/workspaces/Goat",
            internalConfigDir: ceoConfigDir,
          },
        ],
      },
    });

    const response = await activeServer.inject({
      method: "GET",
      url: "/api/agents/goat",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      agent: {
        id: "Goat",
        displayName: "Goat",
        type: "manager",
      },
    });
  });

  it("updates agent profile configuration through the api", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const developerConfigDir = path.resolve(uniqueHomeDir, "agents", "developer");
    await mkdir(developerConfigDir, { recursive: true });
    const configPath = path.resolve(developerConfigDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          id: "developer",
          displayName: "Developer",
          role: "Engineer",
          description: "Engineer OpenClaw agent for Developer.",
          organization: {
            type: "individual",
            reportsTo: "goat",
            discoverable: true,
            tags: ["specialized"],
            priority: 50,
          },
          runtime: {
            provider: { id: "openclaw" },
            skills: { assigned: ["typescript"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const setAgentProvider = vi.fn<
      NonNullable<OpenClawUiService["setAgentProvider"]>
    >(async (agentId, providerId) => {
      return { agentId, providerId };
    });
    const setAgentManager = vi.fn<
      NonNullable<OpenClawUiService["setAgentManager"]>
    >(async (agentId, reportsTo) => {
      return {
        agentId,
        previousReportsTo: "goat",
        reportsTo,
        updatedPaths: [configPath],
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService({ homeDir: uniqueHomeDir }),
        setAgentProvider,
        setAgentManager,
        listAgents: async (): Promise<AgentDescriptor[]> => [
          {
            id: "goat",
            displayName: "Goat",
            workspaceDir: "/tmp/workspaces/goat",
            internalConfigDir: path.resolve(uniqueHomeDir, "agents", "goat"),
          },
          {
            id: "developer",
            displayName: "Developer",
            workspaceDir: "/tmp/workspaces/developer",
            internalConfigDir: developerConfigDir,
          },
        ],
      },
    });

    const response = await activeServer.inject({
      method: "PUT",
      url: "/api/agents/developer",
      payload: {
        displayName: "Frontend Engineer",
        role: "Frontend Engineer",
        description: "Owns UI architecture.",
        type: "individual",
        reportsTo: "goat",
        providerId: "codex",
        discoverable: false,
        tags: "frontend, ui",
        priority: 72,
        skills: ["react", "testing"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(setAgentProvider).toHaveBeenCalledWith("developer", "codex");
    expect(setAgentManager).toHaveBeenCalledWith("developer", "goat");

    const saved = JSON.parse(await readFile(configPath, "utf8")) as {
      displayName: string;
      role: string;
      description: string;
      organization: {
        type: string;
        reportsTo: string | null;
        discoverable: boolean;
        tags: string[];
        priority: number;
      };
      runtime: {
        provider: { id: string };
        skills: { assigned: string[] };
      };
    };
    expect(saved.displayName).toBe("Frontend Engineer");
    expect(saved.role).toBe("Frontend Engineer");
    expect(saved.description).toBe("Owns UI architecture.");
    expect(saved.organization).toMatchObject({
      type: "individual",
      reportsTo: "goat",
      discoverable: false,
      tags: ["frontend", "ui"],
      priority: 72,
    });
    expect(saved.runtime.provider.id).toBe("codex");
    expect(saved.runtime.skills.assigned).toEqual(["react", "testing"]);
  });

  it("rejects assigning reports-to managers that are not OpenClaw agents", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const ceoConfigDir = path.resolve(uniqueHomeDir, "agents", "goat");
    const ctoConfigDir = path.resolve(uniqueHomeDir, "agents", "cto");
    const developerConfigDir = path.resolve(uniqueHomeDir, "agents", "developer");
    await mkdir(ceoConfigDir, { recursive: true });
    await mkdir(ctoConfigDir, { recursive: true });
    await mkdir(developerConfigDir, { recursive: true });

    await writeFile(
      path.resolve(ctoConfigDir, "config.json"),
      JSON.stringify(
        {
          id: "cto",
          displayName: "CTO",
          organization: {
            type: "individual",
            reportsTo: "goat",
            discoverable: true,
            tags: ["specialized"],
            priority: 50,
          },
          runtime: {
            provider: { id: "codex" },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      path.resolve(developerConfigDir, "config.json"),
      JSON.stringify(
        {
          id: "developer",
          displayName: "Developer",
          organization: {
            type: "individual",
            reportsTo: "goat",
            discoverable: true,
            tags: ["specialized"],
            priority: 50,
          },
          runtime: {
            provider: { id: "openclaw" },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const setAgentManager = vi.fn<
      NonNullable<OpenClawUiService["setAgentManager"]>
    >(async (agentId, reportsTo) => {
      return {
        agentId,
        previousReportsTo: "goat",
        reportsTo,
        updatedPaths: [path.resolve(developerConfigDir, "config.json")],
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService({ homeDir: uniqueHomeDir }),
        setAgentManager,
        listAgents: async (): Promise<AgentDescriptor[]> => [
          {
            id: "goat",
            displayName: "Goat",
            workspaceDir: "/tmp/workspaces/goat",
            internalConfigDir: ceoConfigDir,
          },
          {
            id: "cto",
            displayName: "CTO",
            workspaceDir: "/tmp/workspaces/cto",
            internalConfigDir: ctoConfigDir,
          },
          {
            id: "developer",
            displayName: "Developer",
            workspaceDir: "/tmp/workspaces/developer",
            internalConfigDir: developerConfigDir,
          },
        ],
      },
    });

    const response = await activeServer.inject({
      method: "PUT",
      url: "/api/agents/developer",
      payload: {
        reportsTo: "cto",
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error:
        'Cannot assign "cto" as manager because only OpenClaw agents can be managers (found provider "codex").',
    });
    expect(setAgentManager).not.toHaveBeenCalled();
  });

  it("validates payload when updating agent profiles", async () => {
    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: createMockService(),
    });

    const response = await activeServer.inject({
      method: "PUT",
      url: "/api/agents/developer",
      payload: {
        type: "executive",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'type must be either "manager" or "individual".',
    });
  });

  it("creates project session through the api", async () => {
    const prepareSession = vi.fn<NonNullable<OpenClawUiService["prepareSession"]>>(async (_agentId, options): Promise<SessionRunInfo> => {
      const sessionKey = options?.sessionRef ?? "agent:goat:main";
      const isProject = sessionKey.startsWith("project:");
      return {
        agentId: "goat",
        sessionKey,
        sessionId: isProject ? "project-session-1" : "workspace-session-1",
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        isNewSession: !isProject
      };
    });
    const renameSession = vi.fn<NonNullable<OpenClawUiService["renameSession"]>>(async (_agentId, title = "Session", sessionRef = "agent:goat:main"): Promise<SessionSummary> => {
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

  it("does not auto-create organization workspace sessions on startup", async () => {
    const uniqueHomeDir = `/tmp/opengoat-home-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const listSessions = vi.fn<OpenClawUiService["listSessions"]>(async (): Promise<SessionSummary[]> => []);
    const prepareSession = vi.fn<NonNullable<OpenClawUiService["prepareSession"]>>(async (_agentId, options): Promise<SessionRunInfo> => {
      const sessionKey = options?.sessionRef ?? "agent:goat:main";
      return {
        agentId: "goat",
        sessionKey,
        sessionId: "workspace-org-1",
        transcriptPath: "/tmp/transcript.jsonl",
        workspacePath: "/tmp/workspace",
        isNewSession: true
      };
    });
    const renameSession = vi.fn<NonNullable<OpenClawUiService["renameSession"]>>(async (_agentId, title = "Session", sessionRef = "agent:goat:main"): Promise<SessionSummary> => {
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

    expect(listSessions).not.toHaveBeenCalled();
    expect(prepareSession).not.toHaveBeenCalled();
    expect(renameSession).not.toHaveBeenCalled();
  });

  it("creates project session through legacy core fallback when prepareSession is unavailable", async () => {
    const prepareRunSession = vi.fn(async (_paths: unknown, _agentId: string, request: { sessionRef?: string }): Promise<{ enabled: true; info: SessionRunInfo }> => {
      const sessionKey = request.sessionRef ?? "agent:goat:main";
      const isProject = sessionKey.startsWith("project:");
      return {
        enabled: true,
        info: {
          agentId: "goat",
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
        agentId: "goat",
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
    expect(renameSession).toHaveBeenCalledWith("goat", "Renamed", "project:tmp");

    const deleteResponse = await activeServer.inject({
      method: "POST",
      url: "/api/workspaces/delete",
      payload: {
        sessionRef: "project:tmp"
      }
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(removeSession).toHaveBeenCalledTimes(1);
    expect(removeSession).toHaveBeenCalledWith("goat", "project:tmp");

    const removeSessionResponse = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/remove",
      payload: {
        sessionRef: "agent:goat:main"
      }
    });
    expect(removeSessionResponse.statusCode).toBe(200);
    expect(removeSession).toHaveBeenCalledWith("goat", "agent:goat:main");

    const renameSessionResponse = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/rename",
      payload: {
        sessionRef: "agent:goat:main",
        name: "Renamed Session"
      }
    });
    expect(renameSessionResponse.statusCode).toBe(200);
    expect(renameSession).toHaveBeenCalledWith("goat", "Renamed Session", "agent:goat:main");
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
        agentId: "goat",
        sessionRef: "workspace:tmp",
        message: "hello"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "goat",
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
        agentId: "goat",
        sessionRef: "workspace:tmp",
        message: "hello alias"
      }
    });
    expect(aliasResponse.statusCode).toBe(200);
  });

  it("extracts structured assistant payload text from session message output", async () => {
    const runAgent = vi.fn<NonNullable<OpenClawUiService["runAgent"]>>(
      async () => {
        return {
          code: 0,
          stdout: [
            "warning: stale config entry ignored",
            JSON.stringify({
              runId: "run-1",
              status: "ok",
              result: {
                payloads: [
                  {
                    text: "## Proposed Roadmap\nDay 1: validate scope.",
                  },
                  {
                    text: "### Confirmation\nIs this roadmap okay?",
                  },
                ],
              },
            }),
          ].join("\n"),
          stderr: "",
          providerId: "openclaw",
        };
      },
    );

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
        agentId: "goat",
        sessionRef: "workspace:tmp",
        message: "hello",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      output:
        "## Proposed Roadmap\nDay 1: validate scope.\n\n### Confirmation\nIs this roadmap okay?",
    });
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
        agentId: "goat",
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
          `Agent @goat received message: "review 'alpha' release" (session=workspace:tmp).`,
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
        agentId: "goat",
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
      "goat",
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

  it("derives image media type from data URLs when mediaType is omitted", async () => {
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
        agentId: "goat",
        sessionRef: "workspace:tmp",
        images: [
          {
            name: "chart.png",
            dataUrl: "data:image/png;base64,Zm9v",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(runAgent).toHaveBeenCalledWith(
      "goat",
      expect.objectContaining({
        message: "Please analyze the attached image.",
        sessionRef: "workspace:tmp",
        images: [
          {
            name: "chart.png",
            mediaType: "image/png",
            dataUrl: "data:image/png;base64,Zm9v",
          },
        ],
      }),
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
        agentId: "goat",
      });
      options.hooks?.onEvent?.({
        stage: "provider_invocation_started",
        timestamp: "2026-02-13T00:00:00.200Z",
        runId: "run-1",
        agentId: "goat",
        providerId: "codex",
      });
      options.onStdout?.("first stdout line");
      options.onStderr?.("first stderr line");
      options.hooks?.onEvent?.({
        stage: "provider_invocation_completed",
        timestamp: "2026-02-13T00:00:01.000Z",
        runId: "run-1",
        agentId: "goat",
        providerId: "codex",
        code: 0,
      });

      return {
        code: 0,
        stdout: "assistant response",
        stderr: "",
        providerId: "codex",
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
        agentId: "goat",
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
    expect(
      lines.some(
        (line) =>
          line.type === "progress" &&
          line.phase === "provider_invocation_started" &&
          line.message === "Sending request to Codex.",
      ),
    ).toBe(true);
    expect(lines.some((line) => line.type === "result")).toBe(true);
    expect(runAgent).toHaveBeenCalledWith(
      "goat",
      expect.objectContaining({
        message: "hello",
        sessionRef: "workspace:tmp",
        hooks: expect.any(Object),
        onStderr: expect.any(Function),
      }),
    );
  });

  it("streams extracted assistant payload text when runtime returns gateway json envelope", async () => {
    const runAgent = vi.fn<NonNullable<OpenClawUiService["runAgent"]>>(
      async (_agentId, options) => {
        options.hooks?.onEvent?.({
          stage: "run_started",
          timestamp: "2026-02-13T00:00:00.000Z",
          runId: "run-structured",
          agentId: "goat",
        });
        return {
          code: 0,
          stdout: JSON.stringify({
            runId: "run-structured",
            status: "ok",
            result: {
              payloads: [{ text: "Roadmap draft ready." }],
            },
          }),
          stderr: "",
          providerId: "openclaw",
        };
      },
    );

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
        agentId: "goat",
        sessionRef: "workspace:tmp",
        message: "hello",
      },
    });

    expect(response.statusCode).toBe(200);
    const events = response.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; output?: string });
    const resultEvent = events.find((event) => event.type === "result");
    expect(resultEvent?.output).toBe("Roadmap draft ready.");
  });

  it("does not poll OpenClaw runtime logs for non-OpenClaw providers", async () => {
    const getOpenClawGatewayConfig = vi.fn(async () => {
      return {
        mode: "local" as const,
        command: "node",
      };
    });
    const runAgent = vi.fn<
      NonNullable<OpenClawUiService["runAgent"]>
    >(async (_agentId, options) => {
      options.hooks?.onEvent?.({
        stage: "run_started",
        timestamp: "2026-02-13T00:00:00.000Z",
        runId: "run-2",
        agentId: "developer-1",
      });
      options.hooks?.onEvent?.({
        stage: "provider_invocation_started",
        timestamp: "2026-02-13T00:00:00.100Z",
        runId: "run-2",
        agentId: "developer-1",
        providerId: "codex",
      });
      options.hooks?.onEvent?.({
        stage: "provider_invocation_completed",
        timestamp: "2026-02-13T00:00:00.400Z",
        runId: "run-2",
        agentId: "developer-1",
        providerId: "codex",
        code: 0,
      });

      return {
        code: 0,
        stdout: "done",
        stderr: "",
        providerId: "codex",
      };
    });

    activeServer = await createOpenGoatUiServer({
      logger: false,
      attachFrontend: false,
      service: {
        ...createMockService(),
        getOpenClawGatewayConfig,
        runAgent,
      },
    });

    const response = await activeServer.inject({
      method: "POST",
      url: "/api/sessions/message/stream",
      payload: {
        agentId: "developer-1",
        sessionRef: "workspace:tmp",
        message: "hello",
      },
    });

    expect(response.statusCode).toBe(200);

    const lines = response.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; message?: string });
    const progressMessages = lines
      .filter((line) => line.type === "progress")
      .map((line) => line.message ?? "");

    expect(getOpenClawGatewayConfig).not.toHaveBeenCalled();
    expect(
      progressMessages.some((message) =>
        message.includes("Live activity"),
      ),
    ).toBe(false);
    expect(
      progressMessages.some((message) =>
        message.includes("Run accepted by OpenClaw"),
      ),
    ).toBe(false);
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
        agentId: "goat",
        sessionRef: "workspace:tmp",
        message: "hello"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      output: "# Hello\nThis is **markdown**."
    });
  });

  it("strips stale OpenClaw plugin warning noise from stream progress and result output", async () => {
    const runAgent = vi.fn<
      NonNullable<OpenClawUiService["runAgent"]>
    >(async (_agentId, options) => {
      options.onStderr?.(
        "Config warnings:\n- plugins.entries.opengoat-plugin: plugin not found: opengoat-plugin (stale config entry ignored; remove it from plugins config)",
      );

      return {
        code: 1,
        stdout: "",
        stderr:
          "Config warnings:\n- plugins.entries.opengoat-plugin: plugin not found: opengoat-plugin (stale config entry ignored; remove it from plugins config)",
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
        agentId: "goat",
        sessionRef: "workspace:tmp",
        message: "hello",
      },
    });

    expect(response.statusCode).toBe(200);

    const lines = response.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(
        (line) =>
          JSON.parse(line) as {
            type: string;
            phase?: string;
            message?: string;
            output?: string;
          },
      );

    const progressMessages = lines
      .filter((line) => line.type === "progress")
      .map((line) => line.message ?? "");
    const resultLine = lines.find((line) => line.type === "result");

    expect(
      progressMessages.some((message) =>
        message.toLowerCase().includes("plugin not found"),
      ),
    ).toBe(false);
    expect(resultLine?.output ?? "").toBe("");
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
      url: "/api/sessions/history?agentId=goat&sessionRef=workspace%3Atmp&limit=50"
    });

    expect(response.statusCode).toBe(200);
    expect(getSessionHistory).toHaveBeenCalledWith("goat", {
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
      url: "/api/sessions/history?agentId=goat&sessionRef=workspace%3Atmp&limit=50"
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
      updatedAt: "2026-02-11T08:00:00.000Z",
      owner: "goat",
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
        assignedTo: options.assignedTo ?? "goat",
        status: options.status ?? "todo",
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
        actorId: "goat",
        title: "Design API",
        description: "Document API contracts",
        assignedTo: "developer",
        status: "todo"
      }
    });
    expect(createTaskResponse.statusCode).toBe(200);
    expect(createTask).toHaveBeenCalledWith("goat", {
      title: "Design API",
      description: "Document API contracts",
      assignedTo: "developer",
      status: "todo"
    });

    const deleteTaskResponse = await activeServer.inject({
      method: "POST",
      url: "/api/tasks/delete",
      payload: {
        actorId: "goat",
        taskIds: ["task-plan", "task-archive"]
      }
    });
    expect(deleteTaskResponse.statusCode).toBe(200);
    expect(deleteTasks).toHaveBeenCalledWith("goat", ["task-plan", "task-archive"]);

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

function createMockService(
  options: {
    homeDir?: string;
    agents?: AgentDescriptor[];
    runOpenClaw?: (
      args: string[],
      runtimeOptions?: { cwd?: string; env?: NodeJS.ProcessEnv },
    ) => Promise<{ code: number; stdout: string; stderr: string }>;
  } = {},
): OpenClawUiService {
  const homeDir = options.homeDir ?? "/tmp/opengoat-home";
  return {
    initialize: async () => {
      return undefined;
    },
    getHomeDir: () => homeDir,
    listAgents: async (): Promise<AgentDescriptor[]> => options.agents ?? [],
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
    renameSession: async (_agentId, title = "Session", sessionRef = "agent:goat:main"): Promise<SessionSummary> => {
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
    removeSession: async (_agentId, sessionRef = "agent:goat:main"): Promise<{
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
        agentId: "goat",
        sessionKey: "agent:goat:main",
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
    },
    ...(options.runOpenClaw
      ? {
          runOpenClaw: options.runOpenClaw,
        }
      : {}),
  };
}
