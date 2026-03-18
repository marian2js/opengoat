import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentModelUpdatePayload } from "../model-selection";

void test("buildAgentModelUpdatePayload qualifies explicit model selections with the effective provider", () => {
  const payload = buildAgentModelUpdatePayload({
    agent: {
      agentDir: "/tmp/main",
      createdAt: new Date(0).toISOString(),
      id: "main",
      instructions: "You are Main.",
      isDefault: true,
      name: "Main",
      updatedAt: new Date(0).toISOString(),
      workspaceDir: "/tmp/main/workspace",
    },
    effectiveProviderId: "openai-codex",
    nextModelId: "gpt-5.2",
    selectedProviderId: "openai-codex",
  });

  assert.deepEqual(payload, {
    modelId: "gpt-5.2",
    providerId: "openai-codex",
  });
});

void test("buildAgentModelUpdatePayload clears the model without forcing a provider onto inherited agents", () => {
  const payload = buildAgentModelUpdatePayload({
    agent: {
      agentDir: "/tmp/main",
      createdAt: new Date(0).toISOString(),
      id: "main",
      instructions: "You are Main.",
      isDefault: true,
      modelId: "gpt-5.2",
      name: "Main",
      updatedAt: new Date(0).toISOString(),
      workspaceDir: "/tmp/main/workspace",
    },
    effectiveProviderId: "openai-codex",
    nextModelId: "",
    selectedProviderId: "openai-codex",
  });

  assert.deepEqual(payload, {
    modelId: "",
  });
});
