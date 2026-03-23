import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { RunService } from "../../packages/core/src/core/runs/application/run.service.js";
import {
  getValidNextStatuses,
  isTerminalStatus,
  validateTransition,
} from "../../packages/core/src/core/runs/domain/run-state-machine.js";
import { NodeFileSystem } from "../../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../../packages/core/src/platform/node/node-path.port.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

async function createHarness(options?: {
  nowIso?: () => string;
}): Promise<{
  runService: RunService;
  paths: OpenGoatPaths;
}> {
  const root = await createTempDir("opengoat-run-service-");
  roots.push(root);

  const fileSystem = new NodeFileSystem();
  const pathPort = new NodePathPort();
  const paths: OpenGoatPaths = {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
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

  await fileSystem.ensureDir(paths.homeDir);

  const runService = new RunService({
    fileSystem,
    pathPort,
    nowIso: options?.nowIso ?? (() => new Date().toISOString()),
  });

  return { runService, paths };
}

// ---------------------------------------------------------------------------
// State machine tests
// ---------------------------------------------------------------------------

describe("run-state-machine", () => {
  describe("validateTransition", () => {
    it("draft → running succeeds", () => {
      expect(() => validateTransition("draft", "running")).not.toThrow();
    });

    it("running → waiting_review succeeds", () => {
      expect(() => validateTransition("running", "waiting_review")).not.toThrow();
    });

    it("running → blocked succeeds", () => {
      expect(() => validateTransition("running", "blocked")).not.toThrow();
    });

    it("running → completed succeeds", () => {
      expect(() => validateTransition("running", "completed")).not.toThrow();
    });

    it("running → cancelled succeeds", () => {
      expect(() => validateTransition("running", "cancelled")).not.toThrow();
    });

    it("waiting_review → running succeeds", () => {
      expect(() => validateTransition("waiting_review", "running")).not.toThrow();
    });

    it("waiting_review → completed succeeds", () => {
      expect(() => validateTransition("waiting_review", "completed")).not.toThrow();
    });

    it("blocked → running succeeds", () => {
      expect(() => validateTransition("blocked", "running")).not.toThrow();
    });

    it("blocked → cancelled succeeds", () => {
      expect(() => validateTransition("blocked", "cancelled")).not.toThrow();
    });

    it("draft → completed throws", () => {
      expect(() => validateTransition("draft", "completed")).toThrow(
        'Invalid status transition from "draft" to "completed"',
      );
    });

    it("draft → cancelled throws", () => {
      expect(() => validateTransition("draft", "cancelled")).toThrow(
        'Invalid status transition from "draft" to "cancelled"',
      );
    });

    it("completed → running throws (terminal)", () => {
      expect(() => validateTransition("completed", "running")).toThrow(
        'Invalid status transition from "completed" to "running"',
      );
    });

    it("cancelled → running throws (terminal)", () => {
      expect(() => validateTransition("cancelled", "running")).toThrow(
        'Invalid status transition from "cancelled" to "running"',
      );
    });

    it("waiting_review → cancelled throws (not valid)", () => {
      expect(() => validateTransition("waiting_review", "cancelled")).toThrow(
        'Invalid status transition from "waiting_review" to "cancelled"',
      );
    });

    it("blocked → completed throws (not valid)", () => {
      expect(() => validateTransition("blocked", "completed")).toThrow(
        'Invalid status transition from "blocked" to "completed"',
      );
    });
  });

  describe("getValidNextStatuses", () => {
    it("returns 4 statuses for running", () => {
      const next = getValidNextStatuses("running");
      expect(next).toHaveLength(4);
      expect(next).toContain("waiting_review");
      expect(next).toContain("blocked");
      expect(next).toContain("completed");
      expect(next).toContain("cancelled");
    });

    it("returns empty array for terminal statuses", () => {
      expect(getValidNextStatuses("completed")).toHaveLength(0);
      expect(getValidNextStatuses("cancelled")).toHaveLength(0);
    });
  });

  describe("isTerminalStatus", () => {
    it("returns true for completed", () => {
      expect(isTerminalStatus("completed")).toBe(true);
    });

    it("returns true for cancelled", () => {
      expect(isTerminalStatus("cancelled")).toBe(true);
    });

    it("returns false for running", () => {
      expect(isTerminalStatus("running")).toBe(false);
    });

    it("returns false for draft", () => {
      expect(isTerminalStatus("draft")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// RunService CRUD tests
// ---------------------------------------------------------------------------

describe("RunService", () => {
  describe("createRun", () => {
    it("creates run with defaults populated", async () => {
      const harness = await createHarness({
        nowIso: () => "2026-03-01T10:00:00.000Z",
      });

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "objective-1",
        title: "Homepage audit and hero rewrite",
      });

      expect(run.runId).toMatch(/^run-/);
      expect(run.projectId).toBe("project-1");
      expect(run.objectiveId).toBe("objective-1");
      expect(run.title).toBe("Homepage audit and hero rewrite");
      expect(run.status).toBe("draft");
      expect(run.phase).toBe("");
      expect(run.phaseSummary).toBe("");
      expect(run.startedFrom).toBe("dashboard");
      expect(run.agentId).toBe("goat");
      expect(run.sessionId).toBeUndefined();
      expect(run.playbookId).toBeUndefined();
      expect(run.createdAt).toBe("2026-03-01T10:00:00.000Z");
      expect(run.updatedAt).toBe("2026-03-01T10:00:00.000Z");
      expect(run.completedAt).toBeUndefined();
    });

    it("creates run with all optional fields", async () => {
      const harness = await createHarness();

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "objective-1",
        playbookId: "playbook-launch-pack",
        title: "Launch Pack Run",
        startedFrom: "chat",
        agentId: "custom-agent",
        phase: "research",
        phaseSummary: "Researching competitors",
      });

      expect(run.playbookId).toBe("playbook-launch-pack");
      expect(run.startedFrom).toBe("chat");
      expect(run.agentId).toBe("custom-agent");
      expect(run.phase).toBe("research");
      expect(run.phaseSummary).toBe("Researching competitors");
    });

    it("throws with empty title", async () => {
      const harness = await createHarness();

      await expect(
        harness.runService.createRun(harness.paths, {
          projectId: "project-1",
          objectiveId: "objective-1",
          title: "  ",
        }),
      ).rejects.toThrow("Run title must not be empty");
    });

    it("throws with empty projectId", async () => {
      const harness = await createHarness();

      await expect(
        harness.runService.createRun(harness.paths, {
          projectId: "",
          objectiveId: "objective-1",
          title: "Valid title",
        }),
      ).rejects.toThrow("Run projectId must not be empty");
    });

    it("throws with empty objectiveId", async () => {
      const harness = await createHarness();

      await expect(
        harness.runService.createRun(harness.paths, {
          projectId: "project-1",
          objectiveId: "",
          title: "Valid title",
        }),
      ).rejects.toThrow("Run objectiveId must not be empty");
    });
  });

  describe("getRun", () => {
    it("returns correct record", async () => {
      const harness = await createHarness();

      const created = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "objective-1",
        title: "Test Run",
      });

      const fetched = await harness.runService.getRun(
        harness.paths,
        created.runId,
      );

      expect(fetched.runId).toBe(created.runId);
      expect(fetched.title).toBe("Test Run");
      expect(fetched.projectId).toBe("project-1");
    });

    it("throws for non-existent runId", async () => {
      const harness = await createHarness();

      await expect(
        harness.runService.getRun(harness.paths, "non-existent-id"),
      ).rejects.toThrow("Run not found");
    });
  });

  describe("listRuns", () => {
    it("returns all runs for a project", async () => {
      const harness = await createHarness();

      await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Run A",
      });
      await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-2",
        title: "Run B",
      });
      await harness.runService.createRun(harness.paths, {
        projectId: "project-2",
        objectiveId: "obj-3",
        title: "Run C",
      });

      const result = await harness.runService.listRuns(harness.paths, {
        projectId: "project-1",
      });

      expect(result.runs).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.runs.map((r) => r.title).sort()).toEqual(["Run A", "Run B"]);
    });

    it("filters by objectiveId", async () => {
      const harness = await createHarness();

      await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Run A",
      });
      await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-2",
        title: "Run B",
      });

      const result = await harness.runService.listRuns(harness.paths, {
        objectiveId: "obj-1",
      });

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].title).toBe("Run A");
    });

    it("filters by status", async () => {
      const harness = await createHarness();

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Run A",
      });
      await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Run B",
      });

      // Move run A to running
      await harness.runService.updateRunStatus(
        harness.paths,
        run.runId,
        "running",
      );

      const result = await harness.runService.listRuns(harness.paths, {
        status: "running",
      });

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].title).toBe("Run A");
    });

    it("filters with combined criteria", async () => {
      const harness = await createHarness();

      const runA = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Run A",
      });
      await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Run B",
      });
      await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-2",
        title: "Run C",
      });

      await harness.runService.updateRunStatus(
        harness.paths,
        runA.runId,
        "running",
      );

      const result = await harness.runService.listRuns(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        status: "running",
      });

      expect(result.runs).toHaveLength(1);
      expect(result.runs[0].title).toBe("Run A");
    });

    it("pagination: limit and offset work correctly", async () => {
      const harness = await createHarness();

      // Create 5 runs
      for (let i = 1; i <= 5; i++) {
        await harness.runService.createRun(harness.paths, {
          projectId: "project-1",
          objectiveId: "obj-1",
          title: `Run ${i}`,
        });
      }

      const page1 = await harness.runService.listRuns(harness.paths, {
        projectId: "project-1",
        limit: 2,
        offset: 0,
      });

      expect(page1.runs).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.limit).toBe(2);
      expect(page1.offset).toBe(0);

      const page2 = await harness.runService.listRuns(harness.paths, {
        projectId: "project-1",
        limit: 2,
        offset: 2,
      });

      expect(page2.runs).toHaveLength(2);
      expect(page2.total).toBe(5);
      expect(page2.offset).toBe(2);
    });

    it("returns empty list when no runs match", async () => {
      const harness = await createHarness();

      const result = await harness.runService.listRuns(harness.paths, {
        projectId: "non-existent",
      });

      expect(result.runs).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // State transition tests
  // ---------------------------------------------------------------------------

  describe("updateRunStatus", () => {
    it("draft → running succeeds", async () => {
      const harness = await createHarness();

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Test Run",
      });

      const updated = await harness.runService.updateRunStatus(
        harness.paths,
        run.runId,
        "running",
      );

      expect(updated.status).toBe("running");
    });

    it("running → waiting_review succeeds", async () => {
      const harness = await createHarness();

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Test Run",
      });

      await harness.runService.updateRunStatus(harness.paths, run.runId, "running");
      const updated = await harness.runService.updateRunStatus(
        harness.paths,
        run.runId,
        "waiting_review",
      );

      expect(updated.status).toBe("waiting_review");
    });

    it("running → completed sets completedAt", async () => {
      const now = "2026-03-01T10:00:00.000Z";
      const later = "2026-03-01T12:00:00.000Z";
      let currentTime = now;

      const harness = await createHarness({
        nowIso: () => currentTime,
      });

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Test Run",
      });

      await harness.runService.updateRunStatus(harness.paths, run.runId, "running");

      currentTime = later;
      const completed = await harness.runService.updateRunStatus(
        harness.paths,
        run.runId,
        "completed",
      );

      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBe(later);
      expect(completed.updatedAt).toBe(later);
    });

    it("invalid transition throws (draft → completed)", async () => {
      const harness = await createHarness();

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Test Run",
      });

      await expect(
        harness.runService.updateRunStatus(harness.paths, run.runId, "completed"),
      ).rejects.toThrow('Invalid status transition from "draft" to "completed"');
    });

    it("throws for non-existent run", async () => {
      const harness = await createHarness();

      await expect(
        harness.runService.updateRunStatus(
          harness.paths,
          "non-existent",
          "running",
        ),
      ).rejects.toThrow("Run not found");
    });
  });

  describe("completeRun", () => {
    it("sets status to completed and completedAt", async () => {
      const harness = await createHarness();

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Test Run",
      });

      await harness.runService.updateRunStatus(harness.paths, run.runId, "running");
      const completed = await harness.runService.completeRun(
        harness.paths,
        run.runId,
      );

      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeTruthy();
    });
  });

  describe("cancelRun", () => {
    it("sets status to cancelled", async () => {
      const harness = await createHarness();

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Test Run",
      });

      await harness.runService.updateRunStatus(harness.paths, run.runId, "running");
      const cancelled = await harness.runService.cancelRun(
        harness.paths,
        run.runId,
      );

      expect(cancelled.status).toBe("cancelled");
    });
  });

  // ---------------------------------------------------------------------------
  // Phase tests
  // ---------------------------------------------------------------------------

  describe("advancePhase", () => {
    it("updates phase and phaseSummary", async () => {
      const now = "2026-03-01T10:00:00.000Z";
      const later = "2026-03-01T12:00:00.000Z";
      let currentTime = now;

      const harness = await createHarness({
        nowIso: () => currentTime,
      });

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Test Run",
      });

      await harness.runService.updateRunStatus(harness.paths, run.runId, "running");

      currentTime = later;
      const advanced = await harness.runService.advancePhase(
        harness.paths,
        run.runId,
        { phase: "research", phaseSummary: "Researching competitors" },
      );

      expect(advanced.phase).toBe("research");
      expect(advanced.phaseSummary).toBe("Researching competitors");
      expect(advanced.updatedAt).toBe(later);
    });

    it("on non-running run throws", async () => {
      const harness = await createHarness();

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Test Run",
      });

      await expect(
        harness.runService.advancePhase(harness.paths, run.runId, {
          phase: "research",
        }),
      ).rejects.toThrow("Can only advance phase on a running run");
    });

    it("with empty phase string throws", async () => {
      const harness = await createHarness();

      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Test Run",
      });

      await harness.runService.updateRunStatus(harness.paths, run.runId, "running");

      await expect(
        harness.runService.advancePhase(harness.paths, run.runId, {
          phase: "  ",
        }),
      ).rejects.toThrow("Phase name must not be empty");
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("multiple runs per objective can coexist", async () => {
      const harness = await createHarness();

      await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Run 1",
      });
      await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Run 2",
      });

      const result = await harness.runService.listRuns(harness.paths, {
        objectiveId: "obj-1",
      });

      expect(result.runs).toHaveLength(2);
    });

    it("runs with and without playbookId", async () => {
      const harness = await createHarness();

      const withPlaybook = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        playbookId: "playbook-launch",
        title: "With Playbook",
      });

      const withoutPlaybook = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "Without Playbook",
      });

      expect(withPlaybook.playbookId).toBe("playbook-launch");
      expect(withoutPlaybook.playbookId).toBeUndefined();
    });
  });
});
