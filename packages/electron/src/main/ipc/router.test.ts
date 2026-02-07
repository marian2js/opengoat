import { describe, expect, it, vi } from "vitest";
import { createDesktopRouter } from "./router";
import type { WorkbenchService } from "../state/workbench-service";

describe("desktop IPC router", () => {
  it("registers bootstrap/read fallback mutations and executes them through the caller", async () => {
    const service = createServiceStub();
    const router = createDesktopRouter(service);
    const caller = router.createCaller({});

    await caller.bootstrap();
    await caller.bootstrapMutate();
    await caller.projects.listMutate();
    await caller.sessions.messagesMutate({
      projectId: "p1",
      sessionId: "s1"
    });

    expect(service.bootstrap).toHaveBeenCalledTimes(2);
    expect(service.listProjects).toHaveBeenCalledTimes(1);
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
});

function createServiceStub(): WorkbenchService {
  return {
    bootstrap: vi.fn(async () => ({
      homeDir: "/tmp/home",
      projects: [],
      onboarding: {
        activeProviderId: "codex",
        needsOnboarding: true,
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
    listMessages: vi.fn(async () => []),
    getOnboardingState: vi.fn(async () => ({
      activeProviderId: "codex",
      needsOnboarding: true,
      providers: []
    })),
    submitOnboarding: vi.fn(async () => ({
      activeProviderId: "openai",
      needsOnboarding: false,
      providers: []
    })),
    sendMessage: vi.fn(async () => ({
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
