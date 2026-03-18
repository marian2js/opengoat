import assert from "node:assert/strict";
import test from "node:test";
import { createAuthRoutes } from "./auth.ts";

void test("auth routes expose overview and manage connections", async () => {
  let deletedProfileId: string | null = null;
  const runtime = {
    authSessions: {
      start() {
        return Promise.resolve({
          authChoice: "openai-codex",
          id: "session-1",
          methodLabel: "ChatGPT (Codex)",
          progress: ["Starting sign-in flow"],
          providerId: "openai-codex",
          providerName: "OpenAI",
          state: "pending",
          step: {
            message: "Preparing connection flow",
            type: "working",
          },
        });
      },
      get() {
        return {
          authChoice: "openai-codex",
          id: "session-1",
          methodLabel: "ChatGPT (Codex)",
          progress: ["Starting sign-in flow"],
          providerId: "openai-codex",
          providerName: "OpenAI",
          state: "pending",
          step: {
            message: "Preparing connection flow",
            type: "working",
          },
        };
      },
      respond() {
        return {
          authChoice: "openai-codex",
          id: "session-1",
          methodLabel: "ChatGPT (Codex)",
          progress: ["Starting sign-in flow", "Connection completed"],
          providerId: "openai-codex",
          providerName: "OpenAI",
          state: "completed",
          step: {
            message: "Connected OpenAI.",
            type: "completed",
          },
        };
      },
    },
    authService: {
      connectSecret() {
        return Promise.resolve({
          activeModelId: "gpt-5",
          isDefault: true,
          label: "default",
          profileId: "openai:default",
          providerId: "openai",
          providerName: "OpenAI",
          type: "api_key",
          updatedAt: new Date().toISOString(),
        });
      },
      deleteProfile(profileId: string) {
        deletedProfileId = profileId;
        return Promise.resolve();
      },
      getProviderModelCatalog() {
        return Promise.resolve({
          currentModelId: "gpt-5",
          currentModelRef: "openai/gpt-5",
          models: [
            {
              isSelected: true,
              label: "GPT-5",
              modelId: "gpt-5",
              modelRef: "openai/gpt-5",
              providerId: "openai",
            },
          ],
          providerId: "openai",
        });
      },
      getOverview() {
        return Promise.resolve({
          configPath: "/tmp/openclaw.json",
          connections: [],
          providers: [
            {
              id: "openai",
              methods: [
                {
                  id: "openai-codex",
                  input: "oauth",
                  label: "ChatGPT (Codex)",
                  providerId: "openai-codex",
                },
              ],
              name: "OpenAI",
            },
          ],
          selectedProviderId: undefined,
          selectedProfileId: undefined,
          storePath: "/tmp/auth-profiles.json",
        });
      },
      selectProfile() {
        return Promise.resolve({
          activeModelId: "gpt-5",
          isDefault: true,
          label: "default",
          profileId: "openai:default",
          providerId: "openai",
          providerName: "OpenAI",
          type: "api_key",
          updatedAt: new Date().toISOString(),
        });
      },
      setProviderModel() {
        return Promise.resolve({
          configPath: "/tmp/openclaw.json",
          connections: [],
          providers: [
            {
              id: "openai",
              methods: [
                {
                  id: "openai-codex",
                  input: "oauth",
                  label: "ChatGPT (Codex)",
                  providerId: "openai",
                },
              ],
              name: "OpenAI",
            },
          ],
          selectedModelId: "gpt-5",
          selectedProviderId: "openai",
          selectedProfileId: "openai:default",
          storePath: "/tmp/auth-profiles.json",
        });
      },
    },
    config: {
      hostname: "127.0.0.1",
      password: "password",
      port: 3000,
      username: "opengoat",
    },
    embeddedGateway: {} as never,
    gatewaySupervisor: {} as never,
    startedAt: Date.now(),
    version: "0.1.0-test",
  };
  const app = createAuthRoutes(runtime as never);

  const overviewResponse = await app.request("/overview");
  assert.equal(overviewResponse.status, 200);

  const connectResponse = await app.request("/credentials", {
    body: JSON.stringify({
      authChoice: "openai-api-key",
      secret: "sk-test",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  assert.equal(connectResponse.status, 201);

  const modelsResponse = await app.request("/providers/openai/models");
  assert.equal(modelsResponse.status, 200);

  const selectResponse = await app.request("/select", {
    body: JSON.stringify({
      profileId: "openai:default",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  assert.equal(selectResponse.status, 200);

  const setModelResponse = await app.request("/providers/openai/model", {
    body: JSON.stringify({
      modelRef: "openai/gpt-5",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  assert.equal(setModelResponse.status, 200);

  const sessionResponse = await app.request("/sessions", {
    body: JSON.stringify({
      authChoice: "openai-codex",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  assert.equal(sessionResponse.status, 202);

  const deleteResponse = await app.request("/profiles/openai%3Adefault", {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204);
  assert.equal(deletedProfileId, "openai:default");
});
