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
      }
    });

    expect(opengoat.setProviderConfig).toHaveBeenCalledWith("openai", {
      OPENAI_API_KEY: "sk-live"
    });
    expect(opengoat.setAgentProvider).toHaveBeenCalledWith("orchestrator", "openai");
    expect(onboarding.needsOnboarding).toBe(false);
    expect(onboarding.activeProviderId).toBe("openai");
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
    listProjects: vi.fn(async () => [])
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
}): OpenGoatService & {
  setProviderConfig: ReturnType<typeof vi.fn>;
  setAgentProvider: ReturnType<typeof vi.fn>;
} {
  const providerConfigs = new Map<string, ProviderStoredConfig | null>();
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
    setAgentProvider
  } as unknown as OpenGoatService & {
    setProviderConfig: ReturnType<typeof vi.fn>;
    setAgentProvider: ReturnType<typeof vi.fn>;
  };
}
