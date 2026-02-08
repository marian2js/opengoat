import { describe, expect, it, vi } from "vitest";
import type { OpenGoatService, ProviderStoredConfig, ProviderSummary } from "@opengoat/core";
import { WorkbenchService } from "./workbench-service";
import type { WorkbenchStore } from "./workbench-store";

describe("WorkbenchService onboarding", () => {
  it("marks onboarding as required when active provider has no config", async () => {
    const providers = createProviderSummaries();
    const opengoat = createOpenGoatStub({
      providers,
      activeProviderId: "openai",
      onboardingByProvider: {
        openai: {
          env: [
            {
              key: "OPENAI_API_KEY",
              description: "OpenAI API key",
              required: true,
              secret: true
            }
          ]
        }
      }
    });
    const store = createStoreStub();
    const service = new WorkbenchService({ opengoat, store });

    const boot = await service.bootstrap();
    const active = boot.onboarding.providers.find((provider) => provider.id === "openai");

    expect(boot.onboarding.activeProviderId).toBe("openai");
    expect(boot.onboarding.needsOnboarding).toBe(true);
    expect(boot.onboarding.gateway).toEqual({
      mode: "local",
      timeoutMs: 10_000,
      hasAuthToken: false
    });
    expect(boot.onboarding.providers.map((provider) => provider.id)).toEqual(["openai"]);
    expect(boot.onboarding.families).toEqual([
      {
        id: "openai",
        label: "OpenAI",
        providerIds: ["openai"]
      }
    ]);
    expect(active?.missingRequiredEnv).toEqual(["OPENAI_API_KEY"]);
  });

  it("submits onboarding config and clears onboarding requirement", async () => {
    const providers = createProviderSummaries();
    const opengoat = createOpenGoatStub({
      providers,
      activeProviderId: "openai",
      onboardingByProvider: {
        openai: {
          env: [
            {
              key: "OPENAI_API_KEY",
              description: "OpenAI API key",
              required: true,
              secret: true
            }
          ]
        }
      }
    });
    const store = createStoreStub();
    const service = new WorkbenchService({ opengoat, store });

    const onboarding = await service.submitOnboarding({
      providerId: "openai",
      env: {
        OPENAI_API_KEY: "sk-live"
      },
      gateway: {
        mode: "local",
        timeoutMs: 10_000
      }
    });

    expect(opengoat.setProviderConfig).toHaveBeenCalledWith("openai", {
      OPENAI_API_KEY: "sk-live"
    });
    expect(opengoat.setAgentProvider).toHaveBeenCalledWith("orchestrator", "openai");
    expect(onboarding.needsOnboarding).toBe(false);
    expect(onboarding.activeProviderId).toBe("openai");
  });

  it("returns configured non-secret env values for onboarding drafts", async () => {
    const providers = createProviderSummaries();
    const opengoat = createOpenGoatStub({
      providers,
      activeProviderId: "openai",
      onboardingByProvider: {
        openai: {
          env: [
            {
              key: "OPENAI_API_KEY",
              description: "OpenAI API key",
              required: true,
              secret: true
            },
            {
              key: "OPENAI_BASE_URL",
              description: "Optional OpenAI-compatible base URL"
            },
            {
              key: "OPENAI_ENDPOINT_PATH",
              description: "Optional endpoint path"
            }
          ]
        }
      },
      initialProviderConfigs: {
        openai: {
          schemaVersion: 1,
          providerId: "openai",
          env: {
            OPENAI_API_KEY: "sk-live",
            OPENAI_BASE_URL: "https://integrate.api.nvidia.com/v1",
            OPENAI_ENDPOINT_PATH: "/chat/completions"
          },
          updatedAt: "2026-02-07T00:00:00.000Z"
        }
      }
    });
    const store = createStoreStub();
    const service = new WorkbenchService({ opengoat, store });

    const boot = await service.bootstrap();
    const active = boot.onboarding.providers.find((provider) => provider.id === "openai");

    expect(active?.configuredEnvKeys).toEqual([
      "OPENAI_API_KEY",
      "OPENAI_BASE_URL",
      "OPENAI_ENDPOINT_PATH"
    ]);
    expect(active?.configuredEnvValues).toEqual({
      OPENAI_BASE_URL: "https://integrate.api.nvidia.com/v1",
      OPENAI_ENDPOINT_PATH: "/chat/completions"
    });
    expect(active?.missingRequiredEnv).toEqual([]);
  });

  it("runs guided auth and returns env updates", async () => {
    const opengoat = createOpenGoatStub({
      providers: createProviderSummaries(),
      activeProviderId: "openai",
      onboardingByProvider: {}
    });
    const store = createStoreStub();
    const runGuidedAuthFn = vi.fn(async () => ({
      env: {
        QWEN_OAUTH_TOKEN: "qwen-test-token"
      },
      note: "Saved Qwen OAuth token."
    }));
    const service = new WorkbenchService({
      opengoat,
      store,
      resolveGuidedAuthFn: vi.fn((providerId: string) =>
        providerId === "qwen-portal"
          ? {
              title: "Qwen OAuth",
              description: "Open browser and approve access.",
              run: async () => ({
                env: {}
              })
            }
          : undefined
      ),
      runGuidedAuthFn: runGuidedAuthFn as never
    });

    const result = await service.runOnboardingGuidedAuth({
      providerId: "qwen-portal"
    });

    expect(runGuidedAuthFn).toHaveBeenCalledTimes(1);
    expect(result.providerId).toBe("qwen-portal");
    expect(result.env).toEqual({
      QWEN_OAUTH_TOKEN: "qwen-test-token"
    });
    expect(result.note).toBe("Saved Qwen OAuth token.");
  });
});

describe("WorkbenchService sendMessage", () => {
  it("loads project .env values and forwards them to runAgent", async () => {
    const loadDotEnvFn = vi.fn(
      async (params?: { cwd?: string; filename?: string; env?: NodeJS.ProcessEnv }) => {
        const cwd = params?.cwd;
        const env = params?.env;
        if (!cwd || !env) {
          return;
        }
        if (cwd === "/tmp/project") {
          env.OPENAI_API_KEY = "nvapi-test";
          env.OPENAI_BASE_URL = "https://integrate.api.nvidia.com/v1";
          env.OPENAI_MODEL = "meta/llama-3.1-8b-instruct";
        }
      }
    );
    const runAgent = vi.fn(async (..._args: unknown[]) => ({
      code: 0,
      stdout: "completed",
      stderr: "",
      providerId: "openai",
      tracePath: "/tmp/trace.json",
      entryAgentId: "orchestrator",
      routing: {
        entryAgentId: "orchestrator",
        targetAgentId: "orchestrator",
        confidence: 1,
        reason: "test",
        rewrittenMessage: "hello",
        candidates: []
      }
    }));
    const opengoat = createOpenGoatStub({
      providers: createProviderSummaries(),
      activeProviderId: "openai",
      onboardingByProvider: {},
      runAgent
    });
    const appendMessage = vi
      .fn()
      .mockResolvedValueOnce({
        id: "s1",
        title: "Session",
        agentId: "orchestrator",
        sessionKey: "desktop:p1:s1",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        messages: []
      })
      .mockResolvedValueOnce({
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
            content: "completed",
            createdAt: "2026-02-07T00:00:00.000Z",
            providerId: "openai",
            tracePath: "/tmp/trace.json"
          }
        ]
      });
    const store = {
      getGatewaySettings: vi.fn(async () => ({
        mode: "local" as const,
        timeoutMs: 10_000
      })),
      getProject: vi.fn(async () => ({
        id: "p1",
        name: "project",
        rootPath: "/tmp/project",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        sessions: []
      })),
      getSession: vi.fn(async () => ({
        id: "s1",
        title: "Session",
        agentId: "orchestrator",
        sessionKey: "desktop:p1:s1",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        messages: []
      })),
      appendMessage
    } as unknown as WorkbenchStore;

    const service = new WorkbenchService({
      opengoat,
      store,
      loadDotEnvFn
    });

    await service.sendMessage({
      projectId: "p1",
      sessionId: "s1",
      message: "hello"
    });

    expect(runAgent).toHaveBeenCalledTimes(1);
    const runAgentCall = runAgent.mock.calls[0] as unknown[] | undefined;
    const runAgentArgs = (runAgentCall?.[1] ?? {}) as { env?: NodeJS.ProcessEnv };
    expect(runAgentArgs.env?.OPENAI_BASE_URL).toBe("https://integrate.api.nvidia.com/v1");
    expect(runAgentArgs.env?.OPENAI_MODEL).toBe("meta/llama-3.1-8b-instruct");
    expect(loadDotEnvFn).toHaveBeenCalled();
    expect(appendMessage).toHaveBeenCalledTimes(2);
  });

  it("routes runs through remote gateway when remote mode is enabled", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "should-not-run-locally",
      stderr: "",
      providerId: "openai",
      tracePath: "/tmp/local-trace.json",
      entryAgentId: "orchestrator",
      routing: {
        entryAgentId: "orchestrator",
        targetAgentId: "orchestrator",
        confidence: 1,
        reason: "test",
        rewrittenMessage: "hello",
        candidates: []
      }
    }));
    const opengoat = createOpenGoatStub({
      providers: createProviderSummaries(),
      activeProviderId: "openai",
      onboardingByProvider: {},
      runAgent
    });
    const appendMessage = vi
      .fn()
      .mockResolvedValueOnce({
        id: "s1",
        title: "Session",
        agentId: "orchestrator",
        sessionKey: "desktop:p1:s1",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        messages: []
      })
      .mockResolvedValueOnce({
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
            content: "remote-completed",
            createdAt: "2026-02-07T00:00:00.000Z",
            providerId: "openrouter",
            tracePath: "/tmp/remote-trace.json"
          }
        ]
      });
    const store = {
      getGatewaySettings: vi.fn(async () => ({
        mode: "remote" as const,
        remoteUrl: "ws://remote-host:18789/gateway",
        timeoutMs: 8000
      })),
      getProject: vi.fn(async () => ({
        id: "p1",
        name: "project",
        rootPath: "/tmp/project",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        sessions: []
      })),
      getSession: vi.fn(async () => ({
        id: "s1",
        title: "Session",
        agentId: "orchestrator",
        sessionKey: "desktop:p1:s1",
        createdAt: "2026-02-07T00:00:00.000Z",
        updatedAt: "2026-02-07T00:00:00.000Z",
        messages: []
      })),
      appendMessage
    } as unknown as WorkbenchStore;
    const callGatewayFn = vi.fn(async () => ({
      hello: {},
      payload: {
        runId: "run-remote-1",
        result: {
          code: 0,
          stdout: "remote-completed",
          stderr: "",
          providerId: "openrouter",
          tracePath: "/tmp/remote-trace.json"
        }
      }
    }));
    const service = new WorkbenchService({
      opengoat,
      store,
      callGatewayFn: callGatewayFn as never
    });

    await service.sendMessage({
      projectId: "p1",
      sessionId: "s1",
      message: "hello"
    });

    expect(callGatewayFn).toHaveBeenCalledTimes(1);
    expect(runAgent).toHaveBeenCalledTimes(0);
  });
});

describe("WorkbenchService session management", () => {
  it("renames and removes sessions through the store", async () => {
    const opengoat = createOpenGoatStub({
      providers: createProviderSummaries(),
      activeProviderId: "openai",
      onboardingByProvider: {}
    });
    const renameSession = vi.fn(async () => ({
      id: "s1",
      title: "Roadmap",
      agentId: "orchestrator",
      sessionKey: "desktop:p1:s1",
      createdAt: "2026-02-07T00:00:00.000Z",
      updatedAt: "2026-02-07T00:00:00.000Z",
      messages: []
    }));
    const removeSession = vi.fn(async () => undefined);
    const store = {
      renameSession,
      removeSession
    } as unknown as WorkbenchStore;
    const service = new WorkbenchService({ opengoat, store });

    await service.renameSession("p1", "s1", "Roadmap");
    await service.removeSession("p1", "s1");

    expect(renameSession).toHaveBeenCalledWith("p1", "s1", "Roadmap");
    expect(removeSession).toHaveBeenCalledWith("p1", "s1");
  });
});

function createProviderSummaries(): ProviderSummary[] {
  return [
    {
      id: "codex",
      displayName: "Codex",
      kind: "cli",
      capabilities: {
        agent: true,
        model: true,
        auth: true,
        passthrough: true
      }
    },
    {
      id: "openai",
      displayName: "OpenAI",
      kind: "http",
      capabilities: {
        agent: true,
        model: true,
        auth: false,
        passthrough: false
      }
    }
  ];
}

function createStoreStub(): WorkbenchStore {
  return {
    listProjects: vi.fn(async () => []),
    getGatewaySettings: vi.fn(async () => ({
      mode: "local",
      timeoutMs: 10_000
    })),
    setGatewaySettings: vi.fn(async () => ({
      mode: "local",
      timeoutMs: 10_000
    }))
  } as unknown as WorkbenchStore;
}

function createOpenGoatStub(options: {
  providers: ProviderSummary[];
  activeProviderId: string;
  onboardingByProvider: Record<
    string,
    {
      env?: Array<{ key: string; description: string; required?: boolean; secret?: boolean }>;
    }
  >;
  initialProviderConfigs?: Record<string, ProviderStoredConfig>;
  runAgent?: ReturnType<typeof vi.fn>;
}): OpenGoatService & {
  setProviderConfig: ReturnType<typeof vi.fn>;
  setAgentProvider: ReturnType<typeof vi.fn>;
} {
  const providerConfigs = new Map<string, ProviderStoredConfig | null>(
    Object.entries(options.initialProviderConfigs ?? {})
  );
  const activeProvider = { value: options.activeProviderId };

  const setProviderConfig = vi.fn(async (providerId: string, env: Record<string, string>) => {
    const next: ProviderStoredConfig = {
      schemaVersion: 1,
      providerId,
      env,
      updatedAt: "2026-02-07T00:00:00.000Z"
    };
    providerConfigs.set(providerId, next);
    return next;
  });
  const setAgentProvider = vi.fn(async (_agentId: string, providerId: string) => {
    activeProvider.value = providerId;
    return {
      agentId: "orchestrator",
      providerId
    };
  });

  return {
    initialize: vi.fn(async () => ({
      root: "/tmp/home",
      defaultAgent: "orchestrator"
    })),
    getHomeDir: vi.fn(() => "/tmp/home"),
    listProviders: vi.fn(async () => options.providers),
    getAgentProvider: vi.fn(async () => ({
      agentId: "orchestrator",
      providerId: activeProvider.value
    })),
    getProviderOnboarding: vi.fn(async (providerId: string) => options.onboardingByProvider[providerId]),
    getProviderConfig: vi.fn(async (providerId: string) => providerConfigs.get(providerId) ?? null),
    setProviderConfig,
    setAgentProvider,
    runAgent:
      options.runAgent ??
      vi.fn(async () => ({
        code: 0,
        stdout: "ok",
        stderr: "",
        providerId: "openai",
        tracePath: "/tmp/trace.json",
        entryAgentId: "orchestrator",
        routing: {
          entryAgentId: "orchestrator",
          targetAgentId: "orchestrator",
          confidence: 1,
          reason: "test",
          rewrittenMessage: "hello",
          candidates: []
        }
      }))
  } as unknown as OpenGoatService & {
    setProviderConfig: ReturnType<typeof vi.fn>;
    setAgentProvider: ReturnType<typeof vi.fn>;
  };
}
