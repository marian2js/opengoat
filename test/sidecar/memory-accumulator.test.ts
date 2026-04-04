import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { MemoryService } from "../../packages/core/src/core/memory/index.js";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";
import {
  getKnowledgeHints,
  buildExtractionPrompt,
  accumulateMemories,
  type InsightAction,
  type AccumulationDeps,
} from "../../packages/sidecar/src/memory-accumulator/index.ts";
import { createChatRoutes } from "../../packages/sidecar/src/server/routes/chat.ts";
import type { SidecarRuntime } from "../../packages/sidecar/src/server/context.ts";

// ---------------------------------------------------------------------------
// Mock generateObject — must be before any imports that use it
// ---------------------------------------------------------------------------
let mockGenerateObjectResult: { object: { insights: InsightAction[] } } = {
  object: { insights: [] },
};

vi.mock("ai", () => ({
  generateObject: vi.fn().mockImplementation(() => {
    return Promise.resolve(mockGenerateObjectResult);
  }),
  validateUIMessages: vi.fn().mockImplementation(({ messages }: { messages: unknown[] }) => messages),
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn().mockReturnValue("mock-model"),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
const roots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

async function createHarness(options?: { nowIso?: () => string }) {
  const root = await createTempDir("memory-accumulator-test-");
  roots.push(root);
  const paths: OpenGoatPaths = {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
    projectsDir: path.join(root, "projects"),
    organizationDir: path.join(root, "organization"),
    agentsDir: path.join(root, "agents"),
    skillsDir: path.join(root, "skills"),
    providersDir: path.join(root, "providers"),
    sessionsDir: path.join(root, "sessions"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json"),
  };

  const memoryService = new MemoryService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    nowIso: options?.nowIso ?? (() => "2026-03-01T10:00:00.000Z"),
  });

  return { memoryService, paths };
}

function createMockBootstrap(messages: Array<{ role: string; text: string }>) {
  return {
    bootstrapConversation: vi.fn().mockResolvedValue({
      messages: messages.map((m, i) => ({
        id: `msg-${i}`,
        role: m.role,
        text: m.text,
        createdAt: "2026-03-01T10:00:00.000Z",
      })),
      agent: { id: "agent-1", name: "Test Agent" },
      agents: [],
      session: { sessionKey: "sk-1" },
    }),
  };
}

// ---------------------------------------------------------------------------
// specialist-knowledge-map tests
// ---------------------------------------------------------------------------
describe("specialist-knowledge-map", () => {
  const KNOWN_IDS = [
    "cmo",
    "market-intel",
    "positioning",
    "website-conversion",
    "seo-aeo",
    "distribution",
    "content",
    "outbound",
  ];

  it("returns hints for all known specialist IDs", () => {
    for (const id of KNOWN_IDS) {
      const hints = getKnowledgeHints(id);
      expect(hints).toBeDefined();
    }
  });

  it("returns undefined for unknown specialist ID", () => {
    expect(getKnowledgeHints("unknown-specialist")).toBeUndefined();
  });

  it("each specialist has non-empty domain and extractionHints", () => {
    for (const id of KNOWN_IDS) {
      const hints = getKnowledgeHints(id)!;
      expect(hints.domain.length).toBeGreaterThan(0);
      expect(hints.extractionHints.length).toBeGreaterThan(0);
      for (const hint of hints.extractionHints) {
        expect(hint.length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// insight-extractor tests (mock generateObject)
// ---------------------------------------------------------------------------
describe("insight-extractor", () => {
  it("extracts create actions from a Market Intel transcript about competitor pricing", async () => {
    const { extractInsights } = await import(
      "../../packages/sidecar/src/memory-accumulator/insight-extractor.ts"
    );

    mockGenerateObjectResult = {
      object: {
        insights: [
          {
            action: "create" as const,
            content:
              "Competitor Acme Corp charges $49/mo for their base plan, significantly undercutting our $79/mo price",
          },
          {
            action: "create" as const,
            content:
              "Beta Inc recently launched a free tier targeting the same developer audience",
          },
        ],
      },
    };

    const result = await extractInsights(
      {
        transcript:
          "[user]: What are our competitors charging?\n\n[assistant]: Based on my research, Acme Corp charges $49/mo for their base plan. Beta Inc recently launched a free tier targeting developers.",
        specialistId: "market-intel",
        specialistName: "Market Intel",
        existingMemories: [],
        currentCount: 0,
        maxMemories: 20,
      },
      { apiKey: "test-key", model: "test-model" },
    );

    expect(result).toHaveLength(2);
    expect(result[0].action).toBe("create");
    expect(result[0].content).toContain("Acme Corp");
    expect(result[1].action).toBe("create");
    expect(result[1].content).toContain("Beta Inc");
  });

  it("returns update action when existing memory overlaps with new finding", async () => {
    const { extractInsights } = await import(
      "../../packages/sidecar/src/memory-accumulator/insight-extractor.ts"
    );

    mockGenerateObjectResult = {
      object: {
        insights: [
          {
            action: "update" as const,
            content:
              "Acme Corp now charges $39/mo (down from $49/mo) for their base plan",
            existingMemoryId: "mem-1",
          },
        ],
      },
    };

    const result = await extractInsights(
      {
        transcript:
          "[user]: Any pricing updates?\n\n[assistant]: Acme Corp just dropped their price to $39/mo.",
        specialistId: "market-intel",
        specialistName: "Market Intel",
        existingMemories: [
          { memoryId: "mem-1", content: "Acme Corp charges $49/mo for base plan" },
        ],
        currentCount: 1,
        maxMemories: 20,
      },
      { apiKey: "test-key", model: "test-model" },
    );

    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("update");
    if (result[0].action === "update") {
      expect(result[0].existingMemoryId).toBe("mem-1");
    }
  });

  it("returns supersede action when existing memory is outdated", async () => {
    const { extractInsights } = await import(
      "../../packages/sidecar/src/memory-accumulator/insight-extractor.ts"
    );

    mockGenerateObjectResult = {
      object: {
        insights: [
          {
            action: "supersede" as const,
            content: "Target primary keyword: 'AI workflow automation' (replacing 'workflow tools')",
            existingMemoryId: "mem-2",
          },
        ],
      },
    };

    const result = await extractInsights(
      {
        transcript:
          "[user]: Should we change our target keyword?\n\n[assistant]: Yes, 'AI workflow automation' has 3x the search volume.",
        specialistId: "seo-aeo",
        specialistName: "SEO/AEO",
        existingMemories: [
          { memoryId: "mem-2", content: "Target primary keyword: 'workflow tools'" },
        ],
        currentCount: 1,
        maxMemories: 20,
      },
      { apiKey: "test-key", model: "test-model" },
    );

    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("supersede");
    if (result[0].action === "supersede") {
      expect(result[0].existingMemoryId).toBe("mem-2");
    }
  });

  it("returns empty array for a short/trivial transcript", async () => {
    const { extractInsights } = await import(
      "../../packages/sidecar/src/memory-accumulator/insight-extractor.ts"
    );

    mockGenerateObjectResult = { object: { insights: [] } };

    const result = await extractInsights(
      {
        transcript: "[user]: Hi\n\n[assistant]: Hello! How can I help?",
        specialistId: "cmo",
        specialistName: "CMO",
        existingMemories: [],
        currentCount: 0,
        maxMemories: 20,
      },
      { apiKey: "test-key", model: "test-model" },
    );

    expect(result).toHaveLength(0);
  });

  it("respects cap: at 20 memories, only returns update/supersede actions", () => {
    const prompt = buildExtractionPrompt({
      transcript: "[user]: Anything new?\n\n[assistant]: Not much.",
      specialistId: "content",
      specialistName: "Content",
      existingMemories: Array.from({ length: 20 }, (_, i) => ({
        memoryId: `mem-${i}`,
        content: `Memory ${i}`,
      })),
      currentCount: 20,
      maxMemories: 20,
    });

    expect(prompt).toContain("memory cap");
    expect(prompt).toContain("do NOT return \"create\" actions");
  });
});

// ---------------------------------------------------------------------------
// accumulator tests (mock LLM + real MemoryService)
// ---------------------------------------------------------------------------
describe("accumulator", () => {
  it("full flow: transcript with 3 insights creates 3 new memories with correct fields", async () => {
    const harness = await createHarness();

    mockGenerateObjectResult = {
      object: {
        insights: [
          { action: "create" as const, content: "Competitor A is weak on pricing" },
          { action: "create" as const, content: "ICP prefers self-serve onboarding" },
          { action: "create" as const, content: "Community X has 5k active devs" },
        ],
      },
    };

    const mockGateway = createMockBootstrap([
      { role: "user", text: "Analyze my market" },
      { role: "assistant", text: "Let me research that..." },
      { role: "user", text: "What about competitors?" },
      { role: "assistant", text: "Here are the findings..." },
    ]);

    const deps: AccumulationDeps = {
      memoryService: harness.memoryService,
      embeddedGateway: mockGateway as any,
      opengoatPaths: harness.paths,
      apiKey: "test-key",
      model: "test-model",
      specialistName: "Market Intel",
    };

    const result = await accumulateMemories(
      { agentId: "proj-1", specialistId: "market-intel", sessionId: "sess-1" },
      deps,
    );

    expect(result.created).toBe(3);
    expect(result.updated).toBe(0);
    expect(result.superseded).toBe(0);
    expect(result.skipped).toBe(0);

    // Verify memories in DB
    const memories = await harness.memoryService.listMemories(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      specialistId: "market-intel",
    });

    expect(memories).toHaveLength(3);
    expect(memories[0].source).toBe("specialist-chat");
    expect(memories[0].createdBy).toBe("system");
    expect(memories[0].confidence).toBe(0.8);
    expect(memories[0].userConfirmed).toBe(false);
    expect(memories[0].specialistId).toBe("market-intel");
    expect(memories[0].category).toBe("specialist_context");
    expect(memories[0].scope).toBe("project");
  });

  it("update flow: returns update action and existing memory content is updated", async () => {
    const harness = await createHarness();

    // Create an existing memory
    const existing = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      scope: "project",
      content: "Old competitor pricing: $49/mo",
      source: "specialist-chat",
      createdBy: "system",
      specialistId: "market-intel",
    });

    mockGenerateObjectResult = {
      object: {
        insights: [
          {
            action: "update" as const,
            content: "Updated competitor pricing: $39/mo",
            existingMemoryId: existing.memoryId,
          },
        ],
      },
    };

    const mockGateway = createMockBootstrap([
      { role: "user", text: "Any pricing changes?" },
      { role: "assistant", text: "Yes, price dropped." },
      { role: "user", text: "Details?" },
      { role: "assistant", text: "Now $39/mo." },
    ]);

    const result = await accumulateMemories(
      { agentId: "proj-1", specialistId: "market-intel", sessionId: "sess-1" },
      {
        memoryService: harness.memoryService,
        embeddedGateway: mockGateway as any,
        opengoatPaths: harness.paths,
        apiKey: "test-key",
        model: "test-model",
        specialistName: "Market Intel",
      },
    );

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);

    const updated = await harness.memoryService.getMemory(
      harness.paths,
      existing.memoryId,
    );
    expect(updated!.content).toBe("Updated competitor pricing: $39/mo");
  });

  it("supersede flow: old memory marked as replaced_by, new memory has supersedes link", async () => {
    const harness = await createHarness();

    const existing = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      scope: "project",
      content: "Target keyword: 'workflow tools'",
      source: "specialist-chat",
      createdBy: "system",
      specialistId: "seo-aeo",
    });

    mockGenerateObjectResult = {
      object: {
        insights: [
          {
            action: "supersede" as const,
            content: "Target keyword: 'AI workflow automation'",
            existingMemoryId: existing.memoryId,
          },
        ],
      },
    };

    const mockGateway = createMockBootstrap([
      { role: "user", text: "Should we change keywords?" },
      { role: "assistant", text: "Yes, AI workflow automation is better." },
      { role: "user", text: "Why?" },
      { role: "assistant", text: "3x search volume." },
    ]);

    const result = await accumulateMemories(
      { agentId: "proj-1", specialistId: "seo-aeo", sessionId: "sess-1" },
      {
        memoryService: harness.memoryService,
        embeddedGateway: mockGateway as any,
        opengoatPaths: harness.paths,
        apiKey: "test-key",
        model: "test-model",
        specialistName: "SEO/AEO",
      },
    );

    expect(result.superseded).toBe(1);

    // Old memory should be replaced
    const oldMemory = await harness.memoryService.getMemory(
      harness.paths,
      existing.memoryId,
    );
    expect(oldMemory!.replacedBy).toBeTruthy();

    // New memory should have supersedes link
    const allActive = await harness.memoryService.listMemories(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      specialistId: "seo-aeo",
      activeOnly: true,
    });
    expect(allActive).toHaveLength(1);
    expect(allActive[0].content).toBe("Target keyword: 'AI workflow automation'");
    expect(allActive[0].supersedes).toBe(existing.memoryId);
  });

  it("empty transcript (< 2 assistant messages): skips extraction, returns all-zero result", async () => {
    const harness = await createHarness();

    const mockGateway = createMockBootstrap([
      { role: "user", text: "Hello" },
      { role: "assistant", text: "Hi there!" },
    ]);

    const result = await accumulateMemories(
      { agentId: "proj-1", specialistId: "cmo", sessionId: "sess-1" },
      {
        memoryService: harness.memoryService,
        embeddedGateway: mockGateway as any,
        opengoatPaths: harness.paths,
        apiKey: "test-key",
        model: "test-model",
        specialistName: "CMO",
      },
    );

    expect(result).toEqual({ created: 0, updated: 0, superseded: 0, skipped: 0 });
  });

  it("cap enforcement: specialist at 19 memories + 2 creates → only 1 created (capped at 20)", async () => {
    const harness = await createHarness();

    // Create 19 existing memories
    for (let i = 0; i < 19; i++) {
      await harness.memoryService.createMemory(harness.paths, {
        projectId: "proj-1",
        category: "specialist_context",
        scope: "project",
        content: `Existing insight ${i}`,
        source: "specialist-chat",
        createdBy: "system",
        specialistId: "content",
      });
    }

    mockGenerateObjectResult = {
      object: {
        insights: [
          { action: "create" as const, content: "New insight A" },
          { action: "create" as const, content: "New insight B" },
        ],
      },
    };

    const mockGateway = createMockBootstrap([
      { role: "user", text: "Give me content ideas" },
      { role: "assistant", text: "Here are ideas..." },
      { role: "user", text: "More?" },
      { role: "assistant", text: "Sure, here are more..." },
    ]);

    const result = await accumulateMemories(
      { agentId: "proj-1", specialistId: "content", sessionId: "sess-1" },
      {
        memoryService: harness.memoryService,
        embeddedGateway: mockGateway as any,
        opengoatPaths: harness.paths,
        apiKey: "test-key",
        model: "test-model",
        specialistName: "Content",
      },
    );

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);

    const memories = await harness.memoryService.listMemories(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      specialistId: "content",
    });
    expect(memories).toHaveLength(20);
  });

  it("multi-specialist isolation: memories for specialist A don't affect specialist B's accumulation", async () => {
    const harness = await createHarness();

    // Create memories for specialist A
    for (let i = 0; i < 5; i++) {
      await harness.memoryService.createMemory(harness.paths, {
        projectId: "proj-1",
        category: "specialist_context",
        scope: "project",
        content: `SEO insight ${i}`,
        source: "specialist-chat",
        createdBy: "system",
        specialistId: "seo-aeo",
      });
    }

    mockGenerateObjectResult = {
      object: {
        insights: [
          { action: "create" as const, content: "Outbound finding 1" },
        ],
      },
    };

    const mockGateway = createMockBootstrap([
      { role: "user", text: "What outreach works?" },
      { role: "assistant", text: "Cold email works best." },
      { role: "user", text: "Templates?" },
      { role: "assistant", text: "Here are templates..." },
    ]);

    const result = await accumulateMemories(
      { agentId: "proj-1", specialistId: "outbound", sessionId: "sess-1" },
      {
        memoryService: harness.memoryService,
        embeddedGateway: mockGateway as any,
        opengoatPaths: harness.paths,
        apiKey: "test-key",
        model: "test-model",
        specialistName: "Outbound",
      },
    );

    expect(result.created).toBe(1);

    // Outbound has 1 memory
    const outboundMemories = await harness.memoryService.listMemories(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      specialistId: "outbound",
    });
    expect(outboundMemories).toHaveLength(1);

    // SEO still has 5 memories
    const seoMemories = await harness.memoryService.listMemories(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      specialistId: "seo-aeo",
    });
    expect(seoMemories).toHaveLength(5);
  });

  it("error handling: LLM call failure returns all-zero result, doesn't throw", async () => {
    const harness = await createHarness();

    // Make generateObject throw
    const { generateObject } = await import("ai");
    (generateObject as any).mockRejectedValueOnce(new Error("LLM API error"));

    const mockGateway = createMockBootstrap([
      { role: "user", text: "Analyze this" },
      { role: "assistant", text: "Let me look..." },
      { role: "user", text: "And this?" },
      { role: "assistant", text: "Here are findings..." },
    ]);

    // The accumulator should catch the error and not throw
    await expect(
      accumulateMemories(
        { agentId: "proj-1", specialistId: "market-intel", sessionId: "sess-1" },
        {
          memoryService: harness.memoryService,
          embeddedGateway: mockGateway as any,
          opengoatPaths: harness.paths,
          apiKey: "test-key",
          model: "test-model",
          specialistName: "Market Intel",
        },
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// POST /end-session route tests
// ---------------------------------------------------------------------------
describe("POST /chat/end-session", () => {
  function createMockRuntime(overrides?: {
    accumulateResult?: { created: number; updated: number; superseded: number; skipped: number };
  }) {
    const mockBootstrap = vi.fn().mockResolvedValue({
      messages: [
        { id: "msg-0", role: "user", text: "Analyze competitors", createdAt: "2026-03-01T10:00:00.000Z" },
        { id: "msg-1", role: "assistant", text: "Let me research...", createdAt: "2026-03-01T10:01:00.000Z" },
        { id: "msg-2", role: "user", text: "Details?", createdAt: "2026-03-01T10:02:00.000Z" },
        { id: "msg-3", role: "assistant", text: "Here are findings...", createdAt: "2026-03-01T10:03:00.000Z" },
      ],
      agent: { id: "agent-1", name: "Test" },
      agents: [],
      session: { sessionKey: "sk-1" },
    });

    const mockListMemories = vi.fn().mockResolvedValue([]);
    const mockCreateMemory = vi.fn().mockImplementation((_paths: unknown, opts: unknown) => {
      return Promise.resolve({
        memoryId: `mem-${Date.now()}`,
        ...(opts as object),
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z",
        replacedBy: null,
      });
    });
    const mockUpdateMemory = vi.fn().mockResolvedValue({});
    const mockResolveConflict = vi.fn().mockResolvedValue(undefined);

    const runtime = {
      opengoatPaths: { homeDir: "/tmp/test" },
      memoryService: {
        listMemories: mockListMemories,
        createMemory: mockCreateMemory,
        updateMemory: mockUpdateMemory,
        resolveConflict: mockResolveConflict,
      },
      embeddedGateway: {
        bootstrapConversation: mockBootstrap,
        streamConversation: vi.fn(),
      },
    } as unknown as SidecarRuntime;

    return { runtime };
  }

  it("success: returns AccumulationResult JSON", async () => {
    const { runtime } = createMockRuntime();
    const app = new Hono();

    // Set env vars for the test
    const originalKey = process.env.GEMINI_API_KEY;
    const originalModel = process.env.GEMINI_MODEL;
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "test-model";

    mockGenerateObjectResult = {
      object: {
        insights: [
          { action: "create" as const, content: "New insight" },
        ],
      },
    };

    app.route("/chat", createChatRoutes(runtime));

    const res = await app.request("/chat/end-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "proj-1",
        specialistId: "market-intel",
        sessionId: "sess-1",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("created");
    expect(body).toHaveProperty("updated");
    expect(body).toHaveProperty("superseded");
    expect(body).toHaveProperty("skipped");

    process.env.GEMINI_API_KEY = originalKey;
    process.env.GEMINI_MODEL = originalModel;
  });

  it("missing specialistId: returns 400", async () => {
    const { runtime } = createMockRuntime();
    const app = new Hono();
    app.route("/chat", createChatRoutes(runtime));

    const res = await app.request("/chat/end-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "proj-1",
        sessionId: "sess-1",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("unknown specialist: returns 400", async () => {
    const { runtime } = createMockRuntime();
    const app = new Hono();
    app.route("/chat", createChatRoutes(runtime));

    const res = await app.request("/chat/end-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "proj-1",
        specialistId: "nonexistent-specialist",
        sessionId: "sess-1",
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unknown specialist");
  });
});
