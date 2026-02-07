import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_ID } from "../domain/agent-id.js";
import type { ProviderSummary } from "./types.js";
import {
  buildProviderFamilies,
  resolveOnboardingProviderSetupUrl,
  selectProvidersForOnboarding
} from "./onboarding.js";

describe("provider onboarding selection", () => {
  it("keeps only http providers for orchestrator onboarding", () => {
    const providers = createProviders(["codex", "openai", "openrouter"]);

    const selected = selectProvidersForOnboarding(DEFAULT_AGENT_ID, providers);

    expect(selected.map((provider) => provider.id)).toEqual(["openai", "openrouter"]);
  });

  it("keeps cli and http providers for non-orchestrator agents", () => {
    const providers = createProviders(["codex", "openrouter"]);

    const selected = selectProvidersForOnboarding("planner", providers);

    expect(selected.map((provider) => provider.id)).toEqual(["openrouter", "codex"]);
  });
});

describe("provider onboarding families", () => {
  it("organizes known families and preserves unknown providers as leftovers", () => {
    const providers = createProviders(["openai", "openai-codex", "acme-llm"]);

    const families = buildProviderFamilies(providers);

    expect(families).toEqual([
      {
        id: "openai",
        label: "OpenAI",
        providerIds: ["openai", "openai-codex"]
      },
      {
        id: "provider:acme-llm",
        label: "Acme LLM",
        providerIds: ["acme-llm"]
      }
    ]);
  });

  it("resolves provider setup URLs", () => {
    expect(resolveOnboardingProviderSetupUrl("openai")).toBe("https://platform.openai.com/api-keys");
    expect(resolveOnboardingProviderSetupUrl("unknown-provider")).toBeUndefined();
  });
});

function createProviders(ids: string[]): ProviderSummary[] {
  return ids.map((id) => ({
    id,
    displayName: toDisplayName(id),
    kind: id === "codex" ? "cli" : "http",
    capabilities: {
      agent: true,
      model: true,
      auth: false,
      passthrough: false
    }
  }));
}

function toDisplayName(id: string): string {
  if (id === "openai") {
    return "OpenAI";
  }
  if (id === "openai-codex") {
    return "OpenAI Codex";
  }
  if (id === "openrouter") {
    return "OpenRouter";
  }
  if (id === "codex") {
    return "Codex";
  }
  if (id === "acme-llm") {
    return "Acme LLM";
  }
  return id;
}
