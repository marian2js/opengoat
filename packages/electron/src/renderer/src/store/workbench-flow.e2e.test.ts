import { describe, expect, it, vi } from "vitest";
import type { WorkbenchApiClient } from "@renderer/lib/trpc";
import { DESKTOP_IPC_CONTRACT_VERSION, type DesktopContractInfo } from "@shared/workbench-contract";
import type { WorkbenchOnboarding, WorkbenchProject } from "@shared/workbench";
import { WORKBENCH_CHAT_ERROR_PROVIDER_ID } from "@shared/workbench";
import { createWorkbenchStore } from "./workbench-store";

describe("workbench flow e2e", () => {
  it("keeps chat active and appends an inline error message when provider run fails", async () => {
    const api = createStatefulApiMock();
    const store = createWorkbenchStore(api);

    await store.getState().bootstrap();
    expect(store.getState().showOnboarding).toBe(true);
    expect(store.getState().onboardingDraftProviderId).toBe("openai");

    store.getState().setOnboardingDraftProvider("openrouter");
    store.getState().setOnboardingDraftField("OPENROUTER_API_KEY", "openrouter-key");
    await store.getState().submitOnboarding(
      store.getState().onboardingDraftProviderId,
      store.getState().onboardingDraftEnv
    );
    expect(store.getState().onboardingDraftProviderId).toBe("openrouter");
    expect(store.getState().showOnboarding).toBe(false);
    expect(store.getState().onboardingState).toBe("hidden");

    await store.getState().sendMessage("hello");
    expect(store.getState().showOnboarding).toBe(false);
    expect(store.getState().onboardingState).toBe("hidden");
    expect(store.getState().error).toBeNull();
    const messages = store.getState().activeMessages;
    expect(messages[messages.length - 1]?.providerId).toBe(
      WORKBENCH_CHAT_ERROR_PROVIDER_ID
    );
  });
});

function createStatefulApiMock(): WorkbenchApiClient {
  let onboarding: WorkbenchOnboarding = {
    activeProviderId: "openai",
    needsOnboarding: true,
    gateway: {
      mode: "local",
      timeoutMs: 10_000,
      hasAuthToken: false
    },
    families: [],
    providers: [
      {
        id: "openai",
        displayName: "OpenAI",
        kind: "http",
        envFields: [],
        configuredEnvKeys: ["OPENAI_API_KEY"],
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
        hasConfig: false
      }
    ]
  };
  const project: WorkbenchProject = {
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
  };

  const validateContract = vi.fn(async (): Promise<DesktopContractInfo> => ({
    version: DESKTOP_IPC_CONTRACT_VERSION
  }));
  const sendChatMessage = vi.fn(async () => {
    throw new Error("Orchestrator provider failed (openai, code 1). HTTP 401");
  });

  return {
    validateContract,
    bootstrap: vi.fn(async () => ({
      homeDir: "/tmp/home",
      onboarding,
      projects: [project],
      providerSetupCompleted: false
    })),
    listProjects: vi.fn(async () => [project]),
    pickProject: vi.fn(async () => null),
    addProject: vi.fn(async () => project),
    renameProject: vi.fn(async () => project),
    removeProject: vi.fn(async () => undefined),
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
    createAgent: vi.fn(async () => ({
      agent: {
        id: "writer",
        displayName: "Writer",
        workspaceDir: "/tmp/workspaces/writer",
        internalConfigDir: "/tmp/agents/writer"
      },
      createdPaths: [],
      skippedPaths: []
    })),
    deleteAgent: vi.fn(async () => ({
      agentId: "writer",
      existed: true,
      removedPaths: [],
      skippedPaths: []
    })),
    createSession: vi.fn(async () => project.sessions[0]!),
    renameSession: vi.fn(async () => project.sessions[0]!),
    removeSession: vi.fn(async () => undefined),
    getSessionMessages: vi.fn(async () => []),
    getOnboardingStatus: vi.fn(async () => onboarding),
    completeOnboarding: vi.fn(async () => undefined),
    runOnboardingGuidedAuth: vi.fn(async () => ({
      providerId: "openai",
      env: {
        OPENAI_API_KEY: "sk-test"
      },
      notes: ["Guided auth complete."]
    })),
    submitOnboarding: vi.fn(async (input: { providerId: string; env: Record<string, string> }) => {
      onboarding = {
        ...onboarding,
        activeProviderId: input.providerId,
        needsOnboarding: false,
        families: [],
        providers: onboarding.providers.map((provider) =>
          provider.id === input.providerId
            ? {
                ...provider,
                hasConfig: true,
                configuredEnvKeys: Object.keys(input.env),
                configuredEnvValues: {}
              }
            : provider
        )
      };
      return onboarding;
    }),
    getGatewayStatus: vi.fn(async () => onboarding.gateway),
    updateGatewaySettings: vi.fn(async (input: {
      mode: "local" | "remote";
      remoteUrl?: string;
      timeoutMs?: number;
    }) => {
      onboarding = {
        ...onboarding,
        gateway: {
          mode: input.mode,
          remoteUrl: input.remoteUrl,
          timeoutMs: input.timeoutMs ?? 10_000,
          hasAuthToken: false
        }
      };
      return onboarding.gateway;
    }),
    sendChatMessage
  };
}
