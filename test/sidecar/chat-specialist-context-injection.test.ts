import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createChatRoutes } from "../../packages/sidecar/src/server/routes/chat.ts";
import type { SidecarRuntime } from "../../packages/sidecar/src/server/context.ts";

const PATHS = { homeDir: "/tmp/test" };

const MOCK_SPECIALIST_MEMORIES = [
  {
    memoryId: "mem-sp-1",
    projectId: "proj-1",
    objectiveId: null,
    specialistId: "seo-aeo",
    category: "specialist_context",
    scope: "project",
    content: "Prioritize long-tail keywords over brand terms",
    source: "user",
    confidence: 1.0,
    createdBy: "user",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    userConfirmed: true,
    supersedes: null,
    replacedBy: null,
  },
  {
    memoryId: "mem-sp-2",
    projectId: "proj-1",
    objectiveId: null,
    specialistId: "seo-aeo",
    category: "specialist_context",
    scope: "project",
    content: "Focus on comparison pages",
    source: "user",
    confidence: 1.0,
    createdBy: "user",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    userConfirmed: true,
    supersedes: null,
    replacedBy: null,
  },
];

function createMockRuntime() {
  const mockStreamConversation = vi.fn().mockImplementation(() => {
    return new Response("streamed", { status: 200 });
  });

  const runtime = {
    opengoatPaths: PATHS,
    embeddedGateway: {
      bootstrapConversation: vi.fn(),
      streamConversation: mockStreamConversation,
    },
    objectiveService: {
      get: vi.fn().mockResolvedValue(null),
    },
    memoryService: {
      listMemories: vi.fn().mockResolvedValue([]),
    },
    runService: {
      getRun: vi.fn().mockResolvedValue(null),
    },
    artifactService: {
      listArtifacts: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    },
  } as unknown as SidecarRuntime;

  return { runtime, mockStreamConversation };
}

function buildApp(runtime: SidecarRuntime) {
  const app = new Hono();
  app.route("/chat", createChatRoutes(runtime));
  return app;
}

describe("Chat specialist context injection", () => {
  it("injects specialist context when specialistId is provided", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    (runtime.memoryService.listMemories as ReturnType<typeof vi.fn>)
      .mockResolvedValue(MOCK_SPECIALIST_MEMORIES);
    const app = buildApp(runtime);

    await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "Help me with SEO",
        sessionId: "sess-1",
        specialistId: "seo-aeo",
      }),
    });

    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    expect(textPart.text).toContain("<specialist-context>");
    expect(textPart.text).toContain("Specialist Guidelines");
    expect(textPart.text).toContain("Prioritize long-tail keywords over brand terms");
    expect(textPart.text).toContain("Focus on comparison pages");
    expect(textPart.text).toContain("Help me with SEO");
  });

  it("does not inject specialist context when specialistId is absent", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    const app = buildApp(runtime);

    await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "General question",
        sessionId: "sess-1",
      }),
    });

    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    expect(textPart.text).not.toContain("<specialist-context>");
    expect(textPart.text).toBe("General question");
  });

  it("handles specialist context fetch failure gracefully", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    (runtime.memoryService.listMemories as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error("DB error"));
    const app = buildApp(runtime);

    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "Still send this",
        sessionId: "sess-1",
        specialistId: "seo-aeo",
      }),
    });

    expect(res.status).toBe(200);
    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    expect(textPart.text).toContain("Still send this");
  });

  it("injects instructionTemplate even when no specialist memories exist", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    // memoryService returns empty array (default mock) — but specialist has instructionTemplate
    const app = buildApp(runtime);

    await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "No memories here",
        sessionId: "sess-1",
        specialistId: "market-intel",
      }),
    });

    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    // market-intel has an instructionTemplate in the registry, so specialist context should be injected
    expect(textPart.text).toContain("<specialist-context>");
    expect(textPart.text).toContain("Specialist Instructions");
    expect(textPart.text).toContain("No memories here");
  });

  it("injects both instructionTemplate and memories when both exist", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    (runtime.memoryService.listMemories as ReturnType<typeof vi.fn>)
      .mockResolvedValue(MOCK_SPECIALIST_MEMORIES);
    const app = buildApp(runtime);

    await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "SEO with context",
        sessionId: "sess-1",
        specialistId: "seo-aeo",
      }),
    });

    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    expect(textPart.text).toContain("<specialist-context>");
    expect(textPart.text).toContain("Specialist Instructions");
    expect(textPart.text).toContain("Specialist Guidelines");
    expect(textPart.text).toContain("Prioritize long-tail keywords");
    expect(textPart.text).toContain("SEO with context");
  });

  it("does not inject context for invalid specialistId (not in registry)", async () => {
    const { runtime, mockStreamConversation } = createMockRuntime();
    const app = buildApp(runtime);

    await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "goat",
        message: "Unknown specialist",
        sessionId: "sess-1",
        specialistId: "nonexistent-specialist",
      }),
    });

    expect(mockStreamConversation).toHaveBeenCalledTimes(1);
    const callArgs = mockStreamConversation.mock.calls[0][0];
    const textPart = callArgs.message.parts.find((p: { type: string }) => p.type === "text");
    // No memories, no instructionTemplate (specialist not found → undefined)
    expect(textPart.text).toBe("Unknown specialist");
  });
});
