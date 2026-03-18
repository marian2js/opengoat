import test from "node:test";
import assert from "node:assert/strict";
import { createChatRoutes } from "./chat.ts";

void test("chat routes expose bootstrap and stream endpoints", async () => {
  let streamed = false;
  const app = createChatRoutes(
    {
      authSessions: {} as never,
      authService: {} as never,
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
    },
    {
      createChatService: () => ({
        bootstrapConversation() {
          return Promise.resolve({
            agent: {
              agentDir: "/tmp/main",
              createdAt: new Date().toISOString(),
              id: "main",
              instructions: "You are Main.",
              isDefault: true,
              name: "Main",
              updatedAt: new Date().toISOString(),
              workspaceDir: "/tmp/main/workspace",
            },
            agents: [
              {
                agentDir: "/tmp/main",
                createdAt: new Date().toISOString(),
                id: "main",
                instructions: "You are Main.",
                isDefault: true,
                name: "Main",
                updatedAt: new Date().toISOString(),
                workspaceDir: "/tmp/main/workspace",
              },
            ],
            messages: [],
            resolvedModelId: "gpt-5",
            resolvedProviderId: "openai",
            session: {
              agentId: "main",
              agentName: "Main",
              createdAt: new Date().toISOString(),
              id: "session-1",
              sessionFile: "/tmp/main/session.jsonl",
              sessionKey: "agent:main:session:session-1",
              updatedAt: new Date().toISOString(),
              workspaceDir: "/tmp/main/workspace",
            },
          });
        },
        streamConversation() {
          streamed = true;
          return Promise.resolve(new Response("streaming", { status: 200 }));
        },
      }),
    },
  );

  const bootstrapResponse = await app.request("/bootstrap");
  assert.equal(bootstrapResponse.status, 200);
  const bootstrap = (await bootstrapResponse.json()) as {
    agent: { id: string };
    resolvedProviderId?: string;
  };
  assert.equal(bootstrap.agent.id, "main");
  assert.equal(bootstrap.resolvedProviderId, "openai");

  const streamResponse = await app.request("/", {
    body: JSON.stringify({
      agentId: "main",
      message: {
        id: "user-1",
        parts: [{ text: "hello", type: "text" }],
        role: "user",
      },
      sessionId: "session-1",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  assert.equal(streamResponse.status, 200);
  assert.equal(streamed, true);
});

void test("chat routes normalize plain string messages from the transport", async () => {
  let streamed = false;
  const app = createChatRoutes(
    {
      authSessions: {} as never,
      authService: {} as never,
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
    },
    {
      createChatService: () => ({
        bootstrapConversation() {
          throw new Error("not used");
        },
        streamConversation({ message }) {
          streamed = true;
          assert.equal(message.role, "user");
          assert.deepEqual(message.parts, [{ text: "hello", type: "text" }]);
          return Promise.resolve(new Response("streaming", { status: 200 }));
        },
      }),
    },
  );

  const streamResponse = await app.request("/", {
    body: JSON.stringify({
      agentId: "main",
      message: "hello",
      sessionId: "session-1",
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  assert.equal(streamResponse.status, 200);
  assert.equal(streamed, true);
});
