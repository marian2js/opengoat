import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { createChatRoutes } from "../../packages/sidecar/src/server/routes/chat.ts";
import type { SidecarRuntime } from "../../packages/sidecar/src/server/context.ts";

const PATHS = { homeDir: "/tmp/test" };

const MOCK_OBJECTIVE = {
  objectiveId: "obj-1",
  projectId: "proj-1",
  title: "Launch on PH",
  goalType: "launch",
  status: "active",
  summary: "Prepare PH launch",
  createdFrom: "manual",
  isPrimary: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const MOCK_MEMORY = {
  memoryId: "mem-1",
  projectId: "proj-1",
  objectiveId: null,
  category: "brand_voice",
  scope: "project",
  content: "Friendly tone",
  source: "user",
  confidence: 0.9,
  createdBy: "user",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  userConfirmed: true,
  supersedes: null,
  replacedBy: null,
};

function createMockRuntime() {
  let capturedMessage: string | undefined;

  const mockStreamConversation = vi.fn().mockImplementation((params: { message: { parts: { type: string; text: string }[] } }) => {
    // Capture the text of the message for assertions
    const textPart = params.message.parts.find((p: { type: string }) => p.type === "text");
    capturedMessage = textPart?.text;
    return new Response("streamed", { status: 200 });
  });

  const runtime = {
    opengoatPaths: PATHS,
    embeddedGateway: {
      bootstrapConversation: vi.fn(),
      streamConversation: mockStreamConversation,
    },
    objectiveService: {
      get: vi.fn().mockResolvedValue(MOCK_OBJECTIVE),
    },
    memoryService: {
      listMemories: vi.fn().mockResolvedValue([MOCK_MEMORY]),
    },
    runService: {
      getRun: vi.fn().mockResolvedValue(null),
    },
    artifactService: {
      listArtifacts: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    },
  } as unknown as SidecarRuntime;

  return { runtime, mockStreamConversation, getCapturedMessage: () => capturedMessage };
}

function buildApp(runtime: SidecarRuntime) {
  const app = new Hono();
  app.route("/chat", createChatRoutes(runtime));
  return app;
}

describe("Chat scope injection", () => {
  it("passes message through unchanged when no scope is provided", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    const app = buildApp(runtime);

    await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "Hello",
        sessionId: "sess-1",
      }),
    });

    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    expect(textPart.text).toBe("Hello");
    expect(textPart.text).not.toContain("<objective-context>");
  });

  it("injects objective context when objective scope is provided", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    const app = buildApp(runtime);

    await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "Help me plan",
        sessionId: "sess-1",
        scope: {
          type: "objective",
          objectiveId: "obj-1",
        },
      }),
    });

    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    expect(textPart.text).toContain("<objective-context>");
    expect(textPart.text).toContain("Launch on PH");
    expect(textPart.text).toContain("Help me plan");
  });

  it("injects context with run scope", async () => {
    const mockRun = {
      runId: "run-1",
      projectId: "proj-1",
      objectiveId: "obj-1",
      title: "Sprint 1",
      status: "running",
      phase: "research",
      phaseSummary: "Researching",
      startedFrom: "dashboard",
      agentId: "goat",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const { runtime, mockStreamConversation } = createMockRuntime();
    (runtime.runService.getRun as ReturnType<typeof vi.fn>).mockResolvedValue(mockRun);
    const app = buildApp(runtime);

    await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "Continue work",
        sessionId: "sess-1",
        scope: {
          type: "run",
          objectiveId: "obj-1",
          runId: "run-1",
        },
      }),
    });

    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    expect(textPart.text).toContain("<objective-context>");
    expect(textPart.text).toContain("Sprint 1");
    expect(textPart.text).toContain("Continue work");
  });

  it("prepends context block before user message text", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    const app = buildApp(runtime);

    await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "My actual question",
        sessionId: "sess-1",
        scope: {
          type: "objective",
          objectiveId: "obj-1",
        },
      }),
    });

    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    const contextIdx = textPart.text.indexOf("<objective-context>");
    const questionIdx = textPart.text.indexOf("My actual question");
    expect(contextIdx).toBeLessThan(questionIdx);
  });

  it("handles context fetch failure gracefully — still sends message", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    (runtime.objectiveService.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));
    (runtime.memoryService.listMemories as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));
    (runtime.artifactService.listArtifacts as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));
    const app = buildApp(runtime);

    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "Just send this",
        sessionId: "sess-1",
        scope: {
          type: "objective",
          objectiveId: "obj-1",
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    // Message should still go through, possibly without context
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    expect(textPart.text).toContain("Just send this");
  });

  it("accepts structured UIMessage format with scope", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    const app = buildApp(runtime);

    await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: {
          id: "msg-1",
          parts: [{ type: "text", text: "structured message" }],
          role: "user",
        },
        sessionId: "sess-1",
        scope: {
          type: "objective",
          objectiveId: "obj-1",
        },
      }),
    });

    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    expect(textPart.text).toContain("<objective-context>");
    expect(textPart.text).toContain("structured message");
  });
});
