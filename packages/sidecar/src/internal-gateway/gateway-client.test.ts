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
