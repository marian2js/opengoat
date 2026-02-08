import { describe, expect, it, vi } from "vitest";
import type { WorkbenchApiClient } from "@renderer/lib/trpc";
import { DESKTOP_IPC_CONTRACT_VERSION, type DesktopContractInfo } from "@shared/workbench-contract";
import type { WorkbenchBootstrap, WorkbenchOnboarding } from "@shared/workbench";
import { WORKBENCH_CHAT_ERROR_PROVIDER_ID } from "@shared/workbench";
import { createWorkbenchStore, resolveOnboardingDraftProviderId } from "./workbench-store";

describe("workbench store", () => {
  it("keeps preferred onboarding provider if still available", () => {
    const providerId = resolveOnboardingDraftProviderId(
      {
        activeProviderId: "openai",
        needsOnboarding: true,
        gateway: createGatewayStatus(),
        families: [],
        providers: [
          {
            id: "openai",
            displayName: "OpenAI",
            kind: "http",
            envFields: [],
            configuredEnvKeys: [],
            configuredEnvValues: {},
            missingRequiredEnv: [],
            hasConfig: true
          },
          {
            id: "openrouter",
            displayName: "OpenRouter",
            kind: "http",
            envFields: [],
            configuredEnvKeys: [],
            configuredEnvValues: {},
            missingRequiredEnv: [],
            hasConfig: true
          }
        ]
      },
      "openrouter"
    );

    expect(providerId).toBe("openrouter");
  });

  it("falls back to the first onboarding provider when active provider is not in onboarding list", () => {
    const providerId = resolveOnboardingDraftProviderId({
      activeProviderId: "codex",
      needsOnboarding: true,
      gateway: createGatewayStatus(),
      families: [],
      providers: [
        {
          id: "openai",
          displayName: "OpenAI",
          kind: "http",
          envFields: [],
          configuredEnvKeys: [],
          configuredEnvValues: {},
          missingRequiredEnv: ["OPENAI_API_KEY"],
          hasConfig: false
        },
        {
          id: "openrouter",
          displayName: "OpenRouter",
          kind: "http",
          envFields: [],
          configuredEnvKeys: [],
          configuredEnvValues: {},
          missingRequiredEnv: [],
          hasConfig: false
        }
      ]
    });

    expect(providerId).toBe("openai");
  });

  it("retains onboarding draft provider across refreshes", async () => {
    const api = createApiMock();
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    store.getState().setOnboardingDraftProvider("openrouter");
    await store.getState().openOnboarding();

    const state = store.getState();
    expect(state.showOnboarding).toBe(true);
    expect(state.onboardingState).toBe("editing");
    expect(state.onboardingDraftProviderId).toBe("openrouter");
  });

  it("renders provider failures as inline chat errors without reopening onboarding", async () => {
    const api = createApiMock({
      bootstrap: vi.fn(async () => ({
        homeDir: "/tmp/home",
        onboarding: {
          activeProviderId: "openai",
          needsOnboarding: false,
          gateway: createGatewayStatus(),
          families: [],
          providers: []
        },
        providerSetupCompleted: true,
        projects: [
          {
            id: "p1",
            name: "project",
            rootPath: "/tmp/project",
            createdAt: "2026-02-07T00:00:00.000Z",
            updatedAt: "2026-02-07T00:00:00.000Z",
            sessions: [
              {
                id: "s1",
                title: "Session",
                agentId: "orchestrator",
                sessionKey: "desktop:p1:s1",
                createdAt: "2026-02-07T00:00:00.000Z",
                updatedAt: "2026-02-07T00:00:00.000Z",
                messages: []
              }
            ]
          }
        ]
      })) as WorkbenchApiClient["bootstrap"],
      sendChatMessage: vi.fn(async () => {
        throw new Error("Orchestrator provider failed (openai, code 1). HTTP 429: quota exceeded");
      })
    });
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    await store.getState().sendMessage("hello");

    const state = store.getState();
    expect(state.chatState).toBe("idle");
    expect(state.showOnboarding).toBe(false);
    expect(state.onboardingState).toBe("hidden");
    expect(state.error).toBeNull();
    expect(state.activeMessages).toHaveLength(2);
    expect(state.activeMessages[0]?.role).toBe("user");
    expect(state.activeMessages[1]?.role).toBe("assistant");
    expect(state.activeMessages[1]?.providerId).toBe(WORKBENCH_CHAT_ERROR_PROVIDER_ID);
    expect(state.activeMessages[1]?.content.toLowerCase()).toContain("quota");
  });

  it("rethrows send errors when requested for AI SDK transport", async () => {
    const api = createApiMock({
      bootstrap: vi.fn(async () => ({
        homeDir: "/tmp/home",
        onboarding: {
          activeProviderId: "openai",
          needsOnboarding: false,
          gateway: createGatewayStatus(),
          families: [],
          providers: []
        },
        providerSetupCompleted: true,
        projects: [
          {
            id: "p1",
            name: "project",
            rootPath: "/tmp/project",
            createdAt: "2026-02-07T00:00:00.000Z",
            updatedAt: "2026-02-07T00:00:00.000Z",
            sessions: [
              {
                id: "s1",
                title: "Session",
                agentId: "orchestrator",
                sessionKey: "desktop:p1:s1",
                createdAt: "2026-02-07T00:00:00.000Z",
                updatedAt: "2026-02-07T00:00:00.000Z",
                messages: []
              }
            ]
          }
        ]
      })) as WorkbenchApiClient["bootstrap"],
      sendChatMessage: vi.fn(async () => {
        throw new Error("Orchestrator provider failed (openai, code 1). HTTP 401");
      })
    });
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();

    await expect(
      store.getState().sendMessage("hello", {
        rethrow: true
      })
    ).rejects.toThrow("Orchestrator provider failed");
    expect(store.getState().showOnboarding).toBe(false);
    expect(store.getState().activeMessages).toHaveLength(0);
  });

  it("submits onboarding for selected provider and refreshes draft values", async () => {
    const submitOnboardingMock = vi.fn(async (): Promise<WorkbenchOnboarding> => ({
      activeProviderId: "openrouter",
      needsOnboarding: false,
      gateway: createGatewayStatus(),
      families: [],
      providers: [
        {
          id: "openrouter",
          displayName: "OpenRouter",
          kind: "http",
          envFields: [],
          configuredEnvKeys: ["OPENROUTER_API_KEY"],
          configuredEnvValues: {},
          missingRequiredEnv: [],
          hasConfig: true
        }
      ]
    }));
    const api = createApiMock({
      submitOnboarding: submitOnboardingMock as WorkbenchApiClient["submitOnboarding"]
    });
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    store.getState().setOnboardingDraftProvider("openrouter");
    store.getState().setOnboardingDraftField("OPENROUTER_API_KEY", "abc123");
    await store.getState().submitOnboarding(
      store.getState().onboardingDraftProviderId,
      store.getState().onboardingDraftEnv
    );

    expect(submitOnboardingMock).toHaveBeenCalledWith({
      providerId: "openrouter",
      env: {
        OPENROUTER_API_KEY: "abc123"
      }
    });
    expect(store.getState().onboardingState).toBe("hidden");
    expect(store.getState().showOnboarding).toBe(false);
    expect(store.getState().onboardingDraftProviderId).toBe("openrouter");
  });

  it("submits the visible HTTP provider on first-run when active provider is a filtered CLI provider", async () => {
    const submitOnboardingMock = vi.fn(async (): Promise<WorkbenchOnboarding> => ({
      activeProviderId: "openai",
      needsOnboarding: false,
      gateway: createGatewayStatus(),
      families: [],
      providers: [
        {
          id: "openai",
          displayName: "OpenAI",
          kind: "http",
          envFields: [
            {
              key: "OPENAI_API_KEY",
              description: "OpenAI API key",
              required: true,
              secret: true
            }
          ],
          configuredEnvKeys: ["OPENAI_API_KEY"],
          configuredEnvValues: {},
          missingRequiredEnv: [],
          hasConfig: true
        }
      ]
    }));
    const api = createApiMock({
      bootstrap: vi.fn(async () => ({
        homeDir: "/tmp/home",
        providerSetupCompleted: false,
        projects: [],
        onboarding: {
          activeProviderId: "codex",
          needsOnboarding: true,
          gateway: createGatewayStatus(),
          families: [],
          providers: [
            {
              id: "openai",
              displayName: "OpenAI",
              kind: "http",
              envFields: [
                {
                  key: "OPENAI_API_KEY",
                  description: "OpenAI API key",
                  required: true,
                  secret: true
                }
              ],
              configuredEnvKeys: [],
              configuredEnvValues: {},
              missingRequiredEnv: ["OPENAI_API_KEY"],
              hasConfig: false
            }
          ]
        }
      })) as WorkbenchApiClient["bootstrap"],
      submitOnboarding: submitOnboardingMock as WorkbenchApiClient["submitOnboarding"]
    });
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    expect(store.getState().onboardingDraftProviderId).toBe("openai");
    store.getState().setOnboardingDraftField("OPENAI_API_KEY", "sk-test");

    await store.getState().submitOnboarding(
      store.getState().onboardingDraftProviderId,
      store.getState().onboardingDraftEnv
    );

    expect(submitOnboardingMock).toHaveBeenCalledWith({
      providerId: "openai",
      env: {
        OPENAI_API_KEY: "sk-test"
      }
    });
    expect(store.getState().showOnboarding).toBe(false);
  });

  it("keeps onboarding open when submit result still requires setup", async () => {
    const api = createApiMock({
      submitOnboarding: vi.fn(async (): Promise<WorkbenchOnboarding> => ({
        activeProviderId: "openai",
        needsOnboarding: true,
        gateway: createGatewayStatus(),
        families: [],
        providers: [
          {
            id: "openai",
            displayName: "OpenAI",
            kind: "http",
            envFields: [
              {
                key: "OPENAI_API_KEY",
                description: "OpenAI API key",
                required: true,
                secret: true
              }
            ],
            configuredEnvKeys: [],
            configuredEnvValues: {},
            missingRequiredEnv: ["OPENAI_API_KEY"],
            hasConfig: false
          }
        ]
      })) as WorkbenchApiClient["submitOnboarding"]
    });
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    await store.getState().submitOnboarding("openai", {
      OPENAI_API_KEY: "sk-test"
    });

    expect(store.getState().showOnboarding).toBe(true);
    expect(store.getState().onboardingState).toBe("editing");
    expect(store.getState().onboardingDraftEnv.OPENAI_API_KEY).toBe("sk-test");
    expect(store.getState().error).toBe(
      "Provider setup is still incomplete. 1 required field is missing."
    );
  });

  it("runs guided auth and merges env into onboarding draft", async () => {
    const runOnboardingGuidedAuth = vi.fn(async () => ({
      providerId: "qwen-portal",
      env: {
        QWEN_OAUTH_TOKEN: "qwen-token"
      },
      note: "Saved Qwen OAuth token.",
      notes: ["Qwen OAuth complete."]
    }));
    const api = createApiMock({
      runOnboardingGuidedAuth: runOnboardingGuidedAuth as WorkbenchApiClient["runOnboardingGuidedAuth"]
    });
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    await store.getState().runOnboardingGuidedAuth("qwen-portal");

    expect(runOnboardingGuidedAuth).toHaveBeenCalledWith({
      providerId: "qwen-portal"
    });
    expect(store.getState().onboardingGuidedAuthState).toBe("idle");
    expect(store.getState().onboardingDraftEnv.QWEN_OAUTH_TOKEN).toBe("qwen-token");
    expect(store.getState().onboardingNotice).toContain("Saved Qwen OAuth token.");
  });

  it("renames a session and refreshes project list", async () => {
    const renamedProjects = [
      {
        id: "p1",
        name: "project",
        rootPath: "/tmp/project",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        sessions: [
          {
            id: "s1",
            title: "Roadmap",
            agentId: "orchestrator" as const,
            sessionKey: "desktop:p1:s1",
            createdAt: "2026-02-07T00:00:00.000Z",
            updatedAt: "2026-02-07T00:00:00.000Z",
            messages: []
          }
        ]
      }
    ];
    const renameSession = vi.fn(async () => renamedProjects[0]!.sessions[0]!);
    const api = createApiMock({
      renameSession: renameSession as WorkbenchApiClient["renameSession"],
      listProjects: vi.fn(async () => renamedProjects) as WorkbenchApiClient["listProjects"]
    });
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    await store.getState().renameSession("p1", "s1", "Roadmap");

    expect(renameSession).toHaveBeenCalledWith({
      projectId: "p1",
      sessionId: "s1",
      title: "Roadmap"
    });
    expect(store.getState().projects[0]?.sessions[0]?.title).toBe("Roadmap");
  });

  it("renames a project and keeps active selection", async () => {
    const renamedProject = {
      id: "p1",
      name: "Workspace",
      rootPath: "/tmp/project",
      createdAt: "2026-02-07T00:00:00.000Z",
      updatedAt: "2026-02-07T00:00:00.000Z",
      sessions: [
        {
          id: "s1",
          title: "Session",
          agentId: "orchestrator" as const,
          sessionKey: "desktop:p1:s1",
          createdAt: "2026-02-07T00:00:00.000Z",
          updatedAt: "2026-02-07T00:00:00.000Z",
          messages: []
        }
      ]
    };
    const renameProject = vi.fn(async () => renamedProject);
    const api = createApiMock({
      renameProject: renameProject as WorkbenchApiClient["renameProject"]
    });
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    await store.getState().renameProject("p1", "Workspace");

    expect(renameProject).toHaveBeenCalledWith({
      projectId: "p1",
      name: "Workspace"
    });
    expect(store.getState().projects[0]?.name).toBe("Workspace");
    expect(store.getState().activeProjectId).toBe("p1");
  });

  it("removes active project and falls back to remaining project", async () => {
    const base = createApiMock();
    const fallbackProject = {
      id: "home",
      name: "Home",
      rootPath: "/tmp/home",
      createdAt: "2026-02-07T00:00:00.000Z",
      updatedAt: "2026-02-07T00:00:00.000Z",
      sessions: [
        {
          id: "home-s1",
          title: "New Session",
          agentId: "orchestrator" as const,
          sessionKey: "desktop:home:home-s1",
          createdAt: "2026-02-07T00:00:00.000Z",
          updatedAt: "2026-02-07T00:00:00.000Z",
          messages: []
        }
      ]
    };
    const primaryProject = {
      id: "p1",
      name: "project",
      rootPath: "/tmp/project",
      createdAt: "2026-02-07T00:00:00.000Z",
      updatedAt: "2026-02-07T00:00:00.000Z",
      sessions: [
        {
          id: "s1",
          title: "Session",
          agentId: "orchestrator" as const,
          sessionKey: "desktop:p1:s1",
          createdAt: "2026-02-07T00:00:00.000Z",
          updatedAt: "2026-02-07T00:00:00.000Z",
          messages: []
        }
      ]
    };
    base.bootstrap = vi.fn(async () => ({
      homeDir: "/tmp/home",
      onboarding: {
        activeProviderId: "openai",
        needsOnboarding: true,
        gateway: createGatewayStatus(),
        families: [],
        providers: []
      },
      providerSetupCompleted: false,
      projects: [primaryProject, fallbackProject]
    }));
    const removeProject = vi.fn(async () => undefined);
    const api = {
      ...base,
      removeProject
    };
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    await store.getState().removeProject("p1");

    expect(removeProject).toHaveBeenCalledWith({
      projectId: "p1"
    });
    expect(store.getState().activeProjectId).toBe("home");
    expect(store.getState().activeSessionId).toBe("home-s1");
  });

  it("removes active session and clears selection when none remain", async () => {
    const remainingProjects = [
      {
        id: "p1",
        name: "project",
        rootPath: "/tmp/project",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        sessions: []
      }
    ];
    const removeSession = vi.fn(async () => undefined);
    const api = createApiMock({
      removeSession: removeSession as WorkbenchApiClient["removeSession"],
      listProjects: vi.fn(async () => remainingProjects) as WorkbenchApiClient["listProjects"]
    });
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    await store.getState().removeSession("p1", "s1");

    expect(removeSession).toHaveBeenCalledWith({
      projectId: "p1",
      sessionId: "s1"
    });
    expect(store.getState().activeSessionId).toBeNull();
    expect(store.getState().activeMessages).toEqual([]);
  });

  it("surfaces contract mismatch during bootstrap", async () => {
    const api = createApiMock({
      validateContract: (vi.fn(async () => {
        throw new Error("Desktop IPC contract mismatch. Renderer expects v1, main exposes v2.");
      }) as WorkbenchApiClient["validateContract"])
    });
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();

    expect(store.getState().isBootstrapping).toBe(false);
    expect(store.getState().error).toContain("Desktop IPC contract mismatch");
  });
});

function createApiMock(overrides: Partial<WorkbenchApiClient> = {}): WorkbenchApiClient {
  const bootstrapOnboarding: WorkbenchOnboarding = {
    activeProviderId: "openai",
    needsOnboarding: true,
    gateway: createGatewayStatus(),
    families: [],
    providers: [
      {
        id: "openai",
        displayName: "OpenAI",
        kind: "http",
        envFields: [],
        configuredEnvKeys: [],
        configuredEnvValues: {
          OPENAI_BASE_URL: "https://integrate.api.nvidia.com/v1"
        },
        missingRequiredEnv: [],
        hasConfig: true
      },
      {
        id: "openrouter",
        displayName: "OpenRouter",
        kind: "http",
        envFields: [],
        configuredEnvKeys: [],
        configuredEnvValues: {},
        missingRequiredEnv: [],
        hasConfig: true
      }
    ]
  };

  const bootstrapPayload: WorkbenchBootstrap = {
    homeDir: "/tmp/home",
    onboarding: bootstrapOnboarding,
    providerSetupCompleted: false,
    projects: [
      {
        id: "p1",
        name: "project",
        rootPath: "/tmp/project",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        sessions: [
          {
            id: "s1",
            title: "Session",
            agentId: "orchestrator",
            sessionKey: "desktop:p1:s1",
            createdAt: "2026-02-07T00:00:00.000Z",
            updatedAt: "2026-02-07T00:00:00.000Z",
            messages: []
          }
        ]
      }
    ]
  };

  const submittedOnboarding: WorkbenchOnboarding = {
    activeProviderId: "openai",
    needsOnboarding: false,
    gateway: createGatewayStatus(),
    families: [],
    providers: [
      {
        id: "openai",
        displayName: "OpenAI",
        kind: "http",
        envFields: [],
        configuredEnvKeys: [],
        configuredEnvValues: {},
        missingRequiredEnv: [],
        hasConfig: true
      }
    ]
  };

  const assistantReply = {
    id: "m1",
    role: "assistant" as const,
    content: "ok",
    createdAt: "2026-02-07T00:00:00.000Z"
  };

  const base: WorkbenchApiClient = {
    validateContract: vi.fn(async (): Promise<DesktopContractInfo> => ({
      version: DESKTOP_IPC_CONTRACT_VERSION
    })),
    bootstrap: vi.fn(async () => bootstrapPayload),
    listProjects: vi.fn(async () => []),
    pickProject: vi.fn(async () => null),
    addProject: vi.fn(async () => {
      throw new Error("not used");
    }),
    renameProject: vi.fn(async () => {
      throw new Error("not used");
    }),
    removeProject: vi.fn(async () => {
      throw new Error("not used");
    }),
    listAgents: vi.fn(async () => []),
    listAgentProviders: vi.fn(async () => []),
    saveAgentProviderConfig: vi.fn(async (input: { providerId: string; env: Record<string, string> }) => ({
      id: input.providerId,
      displayName: input.providerId,
      kind: "cli",
      envFields: [],
      configuredEnvKeys: Object.keys(input.env),
      configuredEnvValues: { ...input.env },
      hasConfig: Object.keys(input.env).length > 0
    })),
    createAgent: vi.fn(async () => {
      throw new Error("not used");
    }),
    deleteAgent: vi.fn(async () => {
      throw new Error("not used");
    }),
    createSession: vi.fn(async () => {
      throw new Error("not used");
    }),
    renameSession: vi.fn(async () => {
      throw new Error("not used");
    }),
    removeSession: vi.fn(async () => {
      throw new Error("not used");
    }),
    getSessionMessages: vi.fn(async () => []),
    getOnboardingStatus: vi.fn(async () => bootstrapOnboarding),
    completeOnboarding: vi.fn(async () => undefined),
    runOnboardingGuidedAuth: vi.fn(async () => ({
      providerId: "openai",
      env: {
        OPENAI_API_KEY: "sk-test"
      },
      notes: ["Guided auth complete."]
    })),
    submitOnboarding: vi.fn(async () => submittedOnboarding),
    getGatewayStatus: vi.fn(async () => createGatewayStatus()),
    updateGatewaySettings: vi.fn(async () => createGatewayStatus()),
    sendChatMessage: vi.fn(async () => ({
      session: {
        id: "s1",
        title: "Session",
        agentId: "orchestrator" as const,
        sessionKey: "desktop:p1:s1",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        messages: [
          {
            id: "m0",
            role: "user" as const,
            content: "hello",
            createdAt: "2026-02-07T00:00:00.000Z"
          },
          assistantReply
        ]
      },
      reply: assistantReply,
      providerId: "openai"
    }))
  };

  return {
    ...base,
    ...overrides
  };
}

function createGatewayStatus() {
  return {
    mode: "local" as const,
    timeoutMs: 10_000,
    hasAuthToken: false
  };
}
