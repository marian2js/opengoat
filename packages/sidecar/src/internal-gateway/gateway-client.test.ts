import assert from "node:assert/strict";
import test from "node:test";
import type { Agent, ProviderModelCatalog } from "@opengoat/contracts";
import { resolveCompatibleAgentModelRef } from "./gateway-client.ts";

const baseAgent: Agent = {
  agentDir: "/tmp/main",
  createdAt: new Date(0).toISOString(),
  id: "main",
  instructions: "You are Main.",
  isDefault: true,
  name: "Main",
  updatedAt: new Date(0).toISOString(),
  workspaceDir: "/tmp/workspace",
};

const githubCopilotCatalog: ProviderModelCatalog = {
  currentModelId: "gpt-5-mini",
  currentModelRef: "github-copilot/gpt-5-mini",
  models: [
    {
      isSelected: true,
      label: "GPT-5 mini",
      modelId: "gpt-5-mini",
      modelRef: "github-copilot/gpt-5-mini",
      providerId: "github-copilot",
    },
    {
      isSelected: false,
      label: "GPT-4o",
      modelId: "gpt-4o",
      modelRef: "github-copilot/gpt-4o",
      providerId: "github-copilot",
    },
  ],
  providerId: "github-copilot",
};

void test("resolveCompatibleAgentModelRef ignores stale inherited model ids after provider switch", () => {
  const result = resolveCompatibleAgentModelRef({
    agent: {
      ...baseAgent,
      modelId: "gpt-5.4",
    },
    authOverview: {
      selectedModelId: "gpt-5-mini",
      selectedProviderId: "github-copilot",
    },
    providerCatalog: githubCopilotCatalog,
  });

  assert.equal(result, "github-copilot/gpt-5-mini");
});

void test("resolveCompatibleAgentModelRef does not treat bare inherited model ids as explicit provider models", () => {
  const result = resolveCompatibleAgentModelRef({
    agent: {
      ...baseAgent,
      modelId: "gpt-5.4",
    },
    authOverview: {
      selectedModelId: "gpt-5-mini",
      selectedProviderId: "github-copilot",
    },
    providerCatalog: {
      currentModelRef: "github-copilot/gpt-5-mini",
      models: [
        ...githubCopilotCatalog.models,
        {
          isSelected: false,
          label: "GPT-5.4",
          modelId: "gpt-5.4",
          modelRef: "github-copilot/gpt-5.4",
          providerId: "github-copilot",
        },
      ],
      providerId: "github-copilot",
    },
  });

  assert.equal(result, "github-copilot/gpt-5-mini");
});

void test("resolveCompatibleAgentModelRef preserves valid explicit agent models", () => {
  const result = resolveCompatibleAgentModelRef({
    agent: {
      ...baseAgent,
      modelId: "gpt-4o",
      providerId: "github-copilot",
    },
    authOverview: {
      selectedModelId: "gpt-5-mini",
      selectedProviderId: "github-copilot",
    },
    providerCatalog: githubCopilotCatalog,
  });

  assert.equal(result, "github-copilot/gpt-4o");
});

void test("resolveCompatibleAgentModelRef resolves aggregator provider models with nested namespaces", () => {
  const result = resolveCompatibleAgentModelRef({
    agent: baseAgent,
    authOverview: {
      selectedModelId: "free",
      selectedProviderId: "openrouter",
    },
    providerCatalog: {
      currentModelRef: "openrouter/openrouter/free",
      models: [
        {
          isSelected: true,
          label: "Free Models Router",
          modelId: "openrouter/free",
          modelRef: "openrouter/openrouter/free",
          providerId: "openrouter",
        },
        {
          isSelected: false,
          label: "Anthropic: Claude 3.5 Sonnet",
          modelId: "anthropic/claude-3.5-sonnet",
          modelRef: "openrouter/anthropic/claude-3.5-sonnet",
          providerId: "openrouter",
        },
      ],
      providerId: "openrouter",
    },
  });

  assert.equal(result, "openrouter/openrouter/free");
});

void test("resolveCompatibleAgentModelRef resolves aggregator sub-provider model with nested namespace", () => {
  const result = resolveCompatibleAgentModelRef({
    agent: {
      ...baseAgent,
      modelId: "anthropic/claude-3.5-sonnet",
      providerId: "openrouter",
    },
    authOverview: {
      selectedModelId: "free",
      selectedProviderId: "openrouter",
    },
    providerCatalog: {
      currentModelRef: "openrouter/openrouter/free",
      models: [
        {
          isSelected: true,
          label: "Free Models Router",
          modelId: "openrouter/free",
          modelRef: "openrouter/openrouter/free",
          providerId: "openrouter",
        },
        {
          isSelected: false,
          label: "Anthropic: Claude 3.5 Sonnet",
          modelId: "anthropic/claude-3.5-sonnet",
          modelRef: "openrouter/anthropic/claude-3.5-sonnet",
          providerId: "openrouter",
        },
      ],
      providerId: "openrouter",
    },
  });

  // Agent has explicit providerId + modelId with nested namespace — should resolve to catalog ref
  assert.equal(result, "openrouter/anthropic/claude-3.5-sonnet");
});

void test("resolveCompatibleAgentModelRef falls back to default when no catalog is available", () => {
  const result = resolveCompatibleAgentModelRef({
    agent: baseAgent,
    authOverview: {
      selectedModelId: "gpt-5-mini",
      selectedProviderId: "github-copilot",
    },
    providerCatalog: undefined,
  });

  // Without a catalog there's no allowlist to validate against;
  // the function should still produce a usable model ref.
  assert.ok(result);
  assert.ok(result.includes("github-copilot"));
});
