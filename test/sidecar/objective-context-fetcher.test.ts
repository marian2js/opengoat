import { describe, expect, it, vi } from "vitest";
import { fetchObjectiveContext } from "../../packages/sidecar/src/context-composer/objective-context-fetcher.ts";
import type { SidecarRuntime } from "../../packages/sidecar/src/server/context.ts";

const PATHS = { homeDir: "/tmp/test" } as SidecarRuntime["opengoatPaths"];

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

const MOCK_RUN = {
  runId: "run-1",
  projectId: "proj-1",
  objectiveId: "obj-1",
  playbookId: "launch-pack",
  title: "Sprint 1",
  status: "running",
  phase: "research",
  phaseSummary: "Researching competitors",
  startedFrom: "dashboard",
  agentId: "goat",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const MOCK_PLAYBOOK = {
  playbookId: "launch-pack",
  title: "Launch Pack",
  description: "End-to-end launch preparation.",
  idealFor: "Teams preparing to launch.",
  goalTypes: ["launch"],
  requiredInputs: ["product name"],
  optionalInputs: [],
  skillRefs: [],
  defaultPhases: [
    {
      name: "Research",
      description: "Research phase.",
      expectedArtifacts: ["community shortlist"],
      specialistId: "distribution",
    },
  ],
  artifactTypes: ["community shortlist"],
  taskPolicy: "One task per surface.",
  approvalPolicy: "Founder approval.",
  evaluationRubric: "Specificity.",
  version: "1.0.0",
  source: "builtin" as const,
};

const MOCK_ARTIFACT = {
  artifactId: "art-1",
  projectId: "proj-1",
  objectiveId: "obj-1",
  type: "copy_draft",
  title: "Launch copy",
  status: "draft",
  format: "markdown",
  contentRef: "artifacts/art-1.md",
  version: 1,
  createdBy: "goat",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createMockRuntime(overrides: Record<string, unknown> = {}) {
  return {
    opengoatPaths: PATHS,
    objectiveService: {
      get: vi.fn().mockResolvedValue(MOCK_OBJECTIVE),
      ...overrides.objectiveService as object,
    },
    memoryService: {
      listMemories: vi.fn().mockResolvedValue([MOCK_MEMORY]),
      ...overrides.memoryService as object,
    },
    runService: {
      getRun: vi.fn().mockResolvedValue(MOCK_RUN),
      ...overrides.runService as object,
    },
    artifactService: {
      listArtifacts: vi.fn().mockResolvedValue({ items: [MOCK_ARTIFACT], total: 1 }),
      ...overrides.artifactService as object,
    },
    playbookRegistryService: {
      getPlaybook: vi.fn().mockReturnValue(MOCK_PLAYBOOK),
      ...overrides.playbookRegistryService as object,
    },
  } as unknown as SidecarRuntime;
}

describe("fetchObjectiveContext", () => {
  it("fetches context for objective scope", async () => {
    const runtime = createMockRuntime();
    const result = await fetchObjectiveContext(runtime, {
      type: "objective",
      objectiveId: "obj-1",
    }, "proj-1");

    expect(result.objective).toEqual(MOCK_OBJECTIVE);
    expect(result.objectiveMemories).toEqual([MOCK_MEMORY]);
    expect(result.projectMemories).toEqual([MOCK_MEMORY]);
    expect(result.run).toBeNull(); // No run for objective scope
    expect(result.artifacts).toEqual([MOCK_ARTIFACT]);

    // Verify correct service calls
    expect(runtime.objectiveService.get).toHaveBeenCalledWith(PATHS, "obj-1");
    expect(runtime.memoryService.listMemories).toHaveBeenCalledWith(
      PATHS,
      expect.objectContaining({ projectId: "proj-1", objectiveId: "obj-1", scope: "objective" }),
    );
    expect(runtime.memoryService.listMemories).toHaveBeenCalledWith(
      PATHS,
      expect.objectContaining({ projectId: "proj-1", scope: "project" }),
    );
  });

  it("fetches context for run scope including run", async () => {
    const runtime = createMockRuntime();
    const result = await fetchObjectiveContext(runtime, {
      type: "run",
      objectiveId: "obj-1",
      runId: "run-1",
    }, "proj-1");

    expect(result.objective).toEqual(MOCK_OBJECTIVE);
    expect(result.run).toEqual(MOCK_RUN);
    expect(runtime.runService.getRun).toHaveBeenCalledWith(PATHS, "run-1");
  });

  it("handles objective service failure gracefully", async () => {
    const runtime = createMockRuntime({
      objectiveService: { get: vi.fn().mockRejectedValue(new Error("not found")) },
    });
    const result = await fetchObjectiveContext(runtime, {
      type: "objective",
      objectiveId: "obj-1",
    }, "proj-1");

    expect(result.objective).toBeNull();
    // Other fields should still be populated
    expect(result.projectMemories).toEqual([MOCK_MEMORY]);
  });

  it("handles memory service failure gracefully", async () => {
    const runtime = createMockRuntime({
      memoryService: { listMemories: vi.fn().mockRejectedValue(new Error("db error")) },
    });
    const result = await fetchObjectiveContext(runtime, {
      type: "objective",
      objectiveId: "obj-1",
    }, "proj-1");

    expect(result.objective).toEqual(MOCK_OBJECTIVE);
    expect(result.objectiveMemories).toEqual([]);
    expect(result.projectMemories).toEqual([]);
  });

  it("handles run service failure gracefully", async () => {
    const runtime = createMockRuntime({
      runService: { getRun: vi.fn().mockRejectedValue(new Error("run gone")) },
    });
    const result = await fetchObjectiveContext(runtime, {
      type: "run",
      objectiveId: "obj-1",
      runId: "run-1",
    }, "proj-1");

    expect(result.run).toBeNull();
    expect(result.objective).toEqual(MOCK_OBJECTIVE);
  });

  it("handles artifact service failure gracefully", async () => {
    const runtime = createMockRuntime({
      artifactService: { listArtifacts: vi.fn().mockRejectedValue(new Error("db error")) },
    });
    const result = await fetchObjectiveContext(runtime, {
      type: "objective",
      objectiveId: "obj-1",
    }, "proj-1");

    expect(result.artifacts).toEqual([]);
    expect(result.objective).toEqual(MOCK_OBJECTIVE);
  });

  it("does not fetch run for objective-only scope", async () => {
    const runtime = createMockRuntime();
    await fetchObjectiveContext(runtime, {
      type: "objective",
      objectiveId: "obj-1",
      projectId: "proj-1",
    });

    expect(runtime.runService.getRun).not.toHaveBeenCalled();
  });

  describe("playbook manifest fetching", () => {
    it("fetches playbook manifest when scope is run and run has playbookId", async () => {
      const runtime = createMockRuntime();
      const result = await fetchObjectiveContext(runtime, {
        type: "run",
        objectiveId: "obj-1",
        runId: "run-1",
      }, "proj-1");

      expect(result.playbook).toEqual(MOCK_PLAYBOOK);
      expect(runtime.playbookRegistryService.getPlaybook).toHaveBeenCalledWith("launch-pack");
    });

    it("sets playbook to null when scope is objective", async () => {
      const runtime = createMockRuntime();
      const result = await fetchObjectiveContext(runtime, {
        type: "objective",
        objectiveId: "obj-1",
      }, "proj-1");

      expect(result.playbook).toBeNull();
    });

    it("sets playbook to null when run has no playbookId", async () => {
      const runWithoutPlaybook = { ...MOCK_RUN, playbookId: undefined };
      const runtime = createMockRuntime({
        runService: { getRun: vi.fn().mockResolvedValue(runWithoutPlaybook) },
      });
      const result = await fetchObjectiveContext(runtime, {
        type: "run",
        objectiveId: "obj-1",
        runId: "run-1",
      }, "proj-1");

      expect(result.playbook).toBeNull();
    });

    it("sets playbook to null when getPlaybook throws", async () => {
      const runtime = createMockRuntime({
        playbookRegistryService: {
          getPlaybook: vi.fn().mockImplementation(() => {
            throw new Error("Playbook not found");
          }),
        },
      });
      const result = await fetchObjectiveContext(runtime, {
        type: "run",
        objectiveId: "obj-1",
        runId: "run-1",
      }, "proj-1");

      expect(result.playbook).toBeNull();
    });
  });
});
