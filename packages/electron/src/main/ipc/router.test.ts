import { describe, expect, it, vi } from "vitest";
import { DESKTOP_IPC_CONTRACT_VERSION } from "@shared/workbench-contract";
import { createDesktopRouter } from "./router";
import type { WorkbenchService } from "../state/workbench-service";

describe("desktop IPC router", () => {
  it("exposes contract metadata", async () => {
    const service = createServiceStub();
    const router = createDesktopRouter(service);
    const caller = router.createCaller({});

    const contract = await caller.meta.contract();

    expect(contract.version).toBe(DESKTOP_IPC_CONTRACT_VERSION);
  });

  it("executes bootstrap query and read procedures through the caller", async () => {
    const service = createServiceStub();
    const router = createDesktopRouter(service);
    const caller = router.createCaller({});

    await caller.bootstrap();
    await caller.projects.list();
    await caller.sessions.rename({
      projectId: "p1",
      sessionId: "s1",
      title: "Renamed"
    });
    await caller.sessions.remove({
      projectId: "p1",
      sessionId: "s1"
    });
    await caller.sessions.messages({
      projectId: "p1",
      sessionId: "s1"
    });

    expect(service.bootstrap).toHaveBeenCalledTimes(1);
    expect(service.listProjects).toHaveBeenCalledTimes(1);
    expect(service.renameSession).toHaveBeenCalledWith("p1", "s1", "Renamed");
    expect(service.removeSession).toHaveBeenCalledWith("p1", "s1");
    expect(service.listMessages).toHaveBeenCalledWith("p1", "s1");
  });

  it("executes onboarding submit via mutation and forwards payload", async () => {
    const service = createServiceStub();
    const router = createDesktopRouter(service);
    const caller = router.createCaller({});

    await caller.onboarding.submit({
      providerId: "openai",
      env: {
        OPENAI_API_KEY: "sk-test"
      }
    });

    expect(service.submitOnboarding).toHaveBeenCalledWith({
      providerId: "openai",
      env: {
        OPENAI_API_KEY: "sk-test"
      }
    });
  });

  it("executes guided auth via mutation and forwards provider id", async () => {
    const service = createServiceStub();
    const router = createDesktopRouter(service);
    const caller = router.createCaller({});

    await caller.onboarding.guidedAuth({
      providerId: "qwen-portal"
    });

    expect(service.runOnboardingGuidedAuth).toHaveBeenCalledWith({
      providerId: "qwen-portal"
    });
  });

  it("executes gateway update via mutation and forwards payload", async () => {
    const service = createServiceStub();
    const router = createDesktopRouter(service);
    const caller = router.createCaller({});

    await caller.gateway.update({
      mode: "remote",
      remoteUrl: "ws://remote-host:18789/gateway",
      timeoutMs: 9000
    });

    expect(service.updateGateway).toHaveBeenCalledWith({
      mode: "remote",
      remoteUrl: "ws://remote-host:18789/gateway",
      timeoutMs: 9000
    });
  });

  it("initializes router with a callable getErrorShape for Electron IPC transport", () => {
    const service = createServiceStub();
    const router = createDesktopRouter(service) as {
      getErrorShape?: unknown;
    };

    expect(typeof router.getErrorShape).toBe("function");
  });
});

function createServiceStub(): WorkbenchService {
  return {
    bootstrap: vi.fn(async () => ({
      homeDir: "/tmp/home",
      projects: [],
      onboarding: {
        activeProviderId: "codex",
        needsOnboarding: true,
        gateway: {
          mode: "local",
          timeoutMs: 10_000,
          hasAuthToken: false
        },
        families: [],
        providers: []
      }
    })),
    listProjects: vi.fn(async () => []),
    addProject: vi.fn(async () => ({
      id: "p1",
      name: "project",
      rootPath: "/tmp/project",
      createdAt: "2026-02-07T00:00:00.000Z",
      updatedAt: "2026-02-07T00:00:00.000Z",
      sessions: []
    })),
    pickAndAddProject: vi.fn(async () => null),
    listSessions: vi.fn(async () => []),
    createSession: vi.fn(async () => ({
      id: "s1",
      title: "Session",
      agentId: "orchestrator",
      sessionKey: "desktop:p1:s1",
      createdAt: "2026-02-07T00:00:00.000Z",
      updatedAt: "2026-02-07T00:00:00.000Z",
      messages: []
    })),
    renameSession: vi.fn(async () => ({
      id: "s1",
      title: "Renamed",
      agentId: "orchestrator",
      sessionKey: "desktop:p1:s1",
      createdAt: "2026-02-07T00:00:00.000Z",
      updatedAt: "2026-02-07T00:00:00.000Z",
      messages: []
    })),
    removeSession: vi.fn(async () => undefined),
    listMessages: vi.fn(async () => []),
    getOnboardingState: vi.fn(async () => ({
      activeProviderId: "codex",
      needsOnboarding: true,
      gateway: {
        mode: "local",
        timeoutMs: 10_000,
        hasAuthToken: false
      },
      families: [],
      providers: []
    })),
    submitOnboarding: vi.fn(async () => ({
      activeProviderId: "openai",
      needsOnboarding: false,
      gateway: {
        mode: "local",
        timeoutMs: 10_000,
        hasAuthToken: false
      },
      families: [],
      providers: []
    })),
    runOnboardingGuidedAuth: vi.fn(async () => ({
      providerId: "qwen-portal",
      env: {
        QWEN_OAUTH_TOKEN: "qwen-test-token"
      },
      notes: [
        "Qwen OAuth: Open https://chat.qwen.ai/authorize",
        "Qwen OAuth complete."
      ]
    })),
    getGatewayStatus: vi.fn(async () => ({
      mode: "local",
      timeoutMs: 10_000,
      hasAuthToken: false
    })),
    updateGateway: vi.fn(async () => ({
      mode: "local",
      timeoutMs: 10_000,
      hasAuthToken: false
    })),
    sendMessage: vi.fn(async () => ({
      session: {
        id: "s1",
        title: "Session",
        agentId: "orchestrator",
        sessionKey: "desktop:p1:s1",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        messages: [
          {
            id: "m1",
            role: "assistant",
            content: "ok",
            createdAt: "2026-02-07T00:00:00.000Z"
          }
        ]
      },
      reply: {
        id: "m1",
        role: "assistant",
        content: "ok",
        createdAt: "2026-02-07T00:00:00.000Z"
      },
      providerId: "codex"
    }))
  } as unknown as WorkbenchService;
}
