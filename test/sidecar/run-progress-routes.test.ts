import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createRunRoutes } from "../../packages/sidecar/src/server/routes/runs.ts";
import type { SidecarRuntime } from "../../packages/sidecar/src/server/context.ts";

const MOCK_PROGRESS = {
  runId: "run-abc12345",
  playbookId: "launch-pack",
  playbookTitle: "Launch Pack",
  currentPhase: "Research",
  runStatus: "running",
  phases: [
    {
      name: "Research",
      description: "Identify best-fit launch surfaces.",
      status: "current",
      specialistId: "distribution",
      expectedArtifacts: ["community shortlist", "launch timing plan"],
      matchedArtifacts: [],
      missingArtifacts: ["community shortlist", "launch timing plan"],
    },
    {
      name: "Draft",
      description: "Write Product Hunt copy.",
      status: "upcoming",
      specialistId: "distribution",
      expectedArtifacts: ["Product Hunt copy"],
      matchedArtifacts: [],
      missingArtifacts: ["Product Hunt copy"],
    },
  ],
};

function createMockRuntime(overrides: Record<string, unknown> = {}) {
  const runtime = {
    opengoatPaths: { homeDir: "/tmp/test" },
    runService: {
      listRuns: vi.fn().mockResolvedValue({ runs: [], total: 0, limit: 50, offset: 0 }),
      getRun: vi.fn().mockResolvedValue({
        runId: "run-abc12345",
        projectId: "proj-1",
        objectiveId: "obj-1",
        playbookId: "launch-pack",
        title: "Launch Pack",
        status: "running",
        phase: "Research",
        phaseSummary: "Identify best-fit launch surfaces.",
        startedFrom: "action",
        agentId: "goat",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      }),
      createRun: vi.fn(),
      updateRunStatus: vi.fn(),
      advancePhase: vi.fn(),
    },
    playbookExecutionService: {
      getRunProgress: vi.fn().mockResolvedValue(MOCK_PROGRESS),
    },
    ...overrides,
  } as unknown as SidecarRuntime;

  return runtime;
}

function buildApp(runtime: SidecarRuntime) {
  const app = new Hono();
  app.route("/runs", createRunRoutes(runtime));
  app.onError((error, c) => c.json({ error: "Internal Server Error", detail: error.message }, 500));
  return app;
}

describe("GET /runs/:runId/progress", () => {
  it("returns 200 with phase breakdown for valid run", async () => {
    const runtime = createMockRuntime();
    const app = buildApp(runtime);

    const res = await app.request("/runs/run-abc12345/progress");
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual(MOCK_PROGRESS);
  });

  it("response includes currentPhase, runStatus, playbookTitle, and phases", async () => {
    const runtime = createMockRuntime();
    const app = buildApp(runtime);

    const res = await app.request("/runs/run-abc12345/progress");
    const data = await res.json() as typeof MOCK_PROGRESS;

    expect(data.currentPhase).toBe("Research");
    expect(data.runStatus).toBe("running");
    expect(data.playbookTitle).toBe("Launch Pack");
    expect(data.playbookId).toBe("launch-pack");
    expect(data.phases).toHaveLength(2);
  });

  it("phase objects include status, expectedArtifacts, matchedArtifacts, missingArtifacts", async () => {
    const runtime = createMockRuntime();
    const app = buildApp(runtime);

    const res = await app.request("/runs/run-abc12345/progress");
    const data = await res.json() as typeof MOCK_PROGRESS;

    const phase = data.phases[0];
    expect(phase.name).toBe("Research");
    expect(phase.status).toBe("current");
    expect(phase.expectedArtifacts).toEqual(["community shortlist", "launch timing plan"]);
    expect(phase.matchedArtifacts).toEqual([]);
    expect(phase.missingArtifacts).toEqual(["community shortlist", "launch timing plan"]);
  });

  it("returns 404 for non-existent run", async () => {
    const runtime = createMockRuntime({
      playbookExecutionService: {
        getRunProgress: vi.fn().mockRejectedValue(new Error("Run not found")),
      },
    });
    const app = buildApp(runtime);

    const res = await app.request("/runs/run-missing/progress");
    expect(res.status).toBe(404);

    const data = await res.json() as { error: string };
    expect(data.error).toContain("not found");
  });

  it("returns 400 for run not associated with a playbook", async () => {
    const runtime = createMockRuntime({
      playbookExecutionService: {
        getRunProgress: vi
          .fn()
          .mockRejectedValue(new Error("Run is not associated with a playbook")),
      },
    });
    const app = buildApp(runtime);

    const res = await app.request("/runs/run-no-playbook/progress");
    expect(res.status).toBe(400);

    const data = await res.json() as { error: string };
    expect(data.error).toContain("not associated with a playbook");
  });

  it("returns 404 when playbook does not exist in registry", async () => {
    const runtime = createMockRuntime({
      playbookExecutionService: {
        getRunProgress: vi
          .fn()
          .mockRejectedValue(new Error('Playbook "unknown-id" does not exist.')),
      },
    });
    const app = buildApp(runtime);

    const res = await app.request("/runs/run-bad-playbook/progress");
    expect(res.status).toBe(404);

    const data = await res.json() as { error: string };
    expect(data.error).toContain("does not exist");
  });

  it("does not interfere with GET /:runId route", async () => {
    const runtime = createMockRuntime();
    const app = buildApp(runtime);

    const res = await app.request("/runs/run-abc12345");
    expect(res.status).toBe(200);

    const data = await res.json() as { runId: string };
    expect(data.runId).toBe("run-abc12345");
  });
});
