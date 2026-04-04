import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { ArtifactService } from "../../packages/core/src/core/artifacts/application/artifact.service.js";
import { RunService } from "../../packages/core/src/core/runs/application/run.service.js";
import { PlaybookRegistryService } from "../../packages/core/src/core/playbooks/application/playbook-registry.service.js";
import { PlaybookExecutionService } from "../../packages/core/src/core/playbooks/application/playbook-execution.service.js";
import { launchPackPlaybook } from "../../packages/core/src/core/playbooks/manifests/launch-pack.js";
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
  executionService: PlaybookExecutionService;
  runService: RunService;
  artifactService: ArtifactService;
  paths: OpenGoatPaths;
}> {
  const root = await createTempDir("opengoat-playbook-exec-");
  roots.push(root);

  const fileSystem = new NodeFileSystem();
  const pathPort = new NodePathPort();
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

  await fileSystem.ensureDir(paths.homeDir);

  const nowIso = options?.nowIso ?? (() => new Date().toISOString());

  const runService = new RunService({ fileSystem, pathPort, nowIso });
  const artifactService = new ArtifactService({ fileSystem, pathPort, nowIso });
  const playbookRegistryService = new PlaybookRegistryService([launchPackPlaybook]);

  const executionService = new PlaybookExecutionService({
    runService,
    artifactService,
    playbookRegistryService,
  });

  return { executionService, runService, artifactService, paths };
}

describe("PlaybookExecutionService", () => {
  describe("startPlaybook", () => {
    it("creates a run with correct playbookId, title, and initial phase", async () => {
      const harness = await createHarness();

      const run = await harness.executionService.startPlaybook(harness.paths, {
        playbookId: "launch-pack",
        projectId: "project-1",
        objectiveId: "objective-1",
      });

      expect(run.playbookId).toBe("launch-pack");
      expect(run.title).toBe("Launch Pack");
      expect(run.phase).toBe("Research");
      expect(run.status).toBe("running");
      expect(run.startedFrom).toBe("action");
      expect(run.projectId).toBe("project-1");
      expect(run.objectiveId).toBe("objective-1");
    });

    it("throws if playbook not found", async () => {
      const harness = await createHarness();

      await expect(
        harness.executionService.startPlaybook(harness.paths, {
          playbookId: "non-existent",
          projectId: "project-1",
          objectiveId: "objective-1",
        }),
      ).rejects.toThrow("does not exist");
    });
  });

  describe("checkPhaseProgress", () => {
    it("returns advanced: false when artifacts are missing", async () => {
      const harness = await createHarness();

      const run = await harness.executionService.startPlaybook(harness.paths, {
        playbookId: "launch-pack",
        projectId: "project-1",
        objectiveId: "objective-1",
      });

      const result = await harness.executionService.checkPhaseProgress(
        harness.paths,
        run.runId,
      );

      expect(result.advanced).toBe(false);
      expect(result.completed).toBe(false);
    });

    it("advances to next phase when current phase artifacts are detected", async () => {
      const harness = await createHarness();

      const run = await harness.executionService.startPlaybook(harness.paths, {
        playbookId: "launch-pack",
        projectId: "project-1",
        objectiveId: "objective-1",
      });

      // Create artifacts matching Research phase expectedArtifacts
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "community shortlist",
        type: "checklist",
        format: "markdown",
        contentRef: "ref-1",
        createdBy: "distribution",
        runId: run.runId,
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "launch timing plan",
        type: "strategy_note",
        format: "markdown",
        contentRef: "ref-2",
        createdBy: "distribution",
        runId: run.runId,
      });

      const result = await harness.executionService.checkPhaseProgress(
        harness.paths,
        run.runId,
      );

      expect(result.advanced).toBe(true);
      expect(result.completed).toBe(false);
      expect(result.run.phase).toBe("Draft");
    });

    it("completes run when final phase artifacts are detected", async () => {
      const harness = await createHarness();

      const run = await harness.executionService.startPlaybook(harness.paths, {
        playbookId: "launch-pack",
        projectId: "project-1",
        objectiveId: "objective-1",
      });

      // Fast-forward to the final phase ("Finalize")
      await harness.runService.advancePhase(harness.paths, run.runId, {
        phase: "Finalize",
        phaseSummary: "Finalizing",
      });

      // Create artifacts matching Finalize phase
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "launch checklist",
        type: "checklist",
        format: "markdown",
        contentRef: "ref-1",
        createdBy: "distribution",
        runId: run.runId,
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "launch assets list",
        type: "dataset_list",
        format: "markdown",
        contentRef: "ref-2",
        createdBy: "distribution",
        runId: run.runId,
      });

      const result = await harness.executionService.checkPhaseProgress(
        harness.paths,
        run.runId,
      );

      expect(result.advanced).toBe(false);
      expect(result.completed).toBe(true);
      expect(result.run.status).toBe("completed");
    });
  });

  describe("getRunProgress", () => {
    it("returns correct phase breakdown with expected vs actual artifacts", async () => {
      const harness = await createHarness();

      const run = await harness.executionService.startPlaybook(harness.paths, {
        playbookId: "launch-pack",
        projectId: "project-1",
        objectiveId: "objective-1",
      });

      // Add one artifact for the Research phase
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "community shortlist",
        type: "checklist",
        format: "markdown",
        contentRef: "ref-1",
        createdBy: "distribution",
        runId: run.runId,
      });

      const progress = await harness.executionService.getRunProgress(
        harness.paths,
        run.runId,
      );

      expect(progress.runId).toBe(run.runId);
      expect(progress.playbookId).toBe("launch-pack");
      expect(progress.currentPhase).toBe("Research");
      expect(progress.phases).toHaveLength(4);

      // Research phase should be current with 1 matched, 1 missing
      const research = progress.phases[0];
      expect(research.name).toBe("Research");
      expect(research.status).toBe("current");
      expect(research.matchedArtifacts).toHaveLength(1);
      expect(research.missingArtifacts).toEqual(["launch timing plan"]);

      // Draft phase should be upcoming
      const draft = progress.phases[1];
      expect(draft.name).toBe("Draft");
      expect(draft.status).toBe("upcoming");
    });

    it("throws for run without playbookId", async () => {
      const harness = await createHarness();

      // Create a run without playbookId
      const run = await harness.runService.createRun(harness.paths, {
        projectId: "project-1",
        objectiveId: "objective-1",
        title: "Manual run",
      });

      await expect(
        harness.executionService.getRunProgress(harness.paths, run.runId),
      ).rejects.toThrow("not associated with a playbook");
    });
  });

  describe("full lifecycle", () => {
    it("start → phase 1 artifacts → phase 2 → ... → run completes", async () => {
      const harness = await createHarness();

      // Start playbook
      const run = await harness.executionService.startPlaybook(harness.paths, {
        playbookId: "launch-pack",
        projectId: "project-1",
        objectiveId: "objective-1",
      });

      expect(run.phase).toBe("Research");
      expect(run.status).toBe("running");

      // --- Phase 1: Research ---
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "community shortlist",
        type: "checklist",
        format: "markdown",
        contentRef: "ref-1",
        createdBy: "distribution",
        runId: run.runId,
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "launch timing plan",
        type: "strategy_note",
        format: "markdown",
        contentRef: "ref-2",
        createdBy: "distribution",
        runId: run.runId,
      });

      const after1 = await harness.executionService.checkPhaseProgress(
        harness.paths,
        run.runId,
      );
      expect(after1.advanced).toBe(true);
      expect(after1.run.phase).toBe("Draft");

      // --- Phase 2: Draft ---
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "Product Hunt copy",
        type: "copy_draft",
        format: "markdown",
        contentRef: "ref-3",
        createdBy: "distribution",
        runId: run.runId,
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "FAQ pack",
        type: "copy_draft",
        format: "markdown",
        contentRef: "ref-4",
        createdBy: "distribution",
        runId: run.runId,
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "community post angles",
        type: "copy_draft",
        format: "markdown",
        contentRef: "ref-5",
        createdBy: "distribution",
        runId: run.runId,
      });

      const after2 = await harness.executionService.checkPhaseProgress(
        harness.paths,
        run.runId,
      );
      expect(after2.advanced).toBe(true);
      expect(after2.run.phase).toBe("Review");

      // --- Phase 3: Review ---
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "revised launch copy",
        type: "copy_draft",
        format: "markdown",
        contentRef: "ref-6",
        createdBy: "cmo",
        runId: run.runId,
      });

      const after3 = await harness.executionService.checkPhaseProgress(
        harness.paths,
        run.runId,
      );
      expect(after3.advanced).toBe(true);
      expect(after3.run.phase).toBe("Finalize");

      // --- Phase 4: Finalize ---
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "launch checklist",
        type: "checklist",
        format: "markdown",
        contentRef: "ref-7",
        createdBy: "distribution",
        runId: run.runId,
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "launch assets list",
        type: "dataset_list",
        format: "markdown",
        contentRef: "ref-8",
        createdBy: "distribution",
        runId: run.runId,
      });

      const after4 = await harness.executionService.checkPhaseProgress(
        harness.paths,
        run.runId,
      );
      expect(after4.completed).toBe(true);
      expect(after4.run.status).toBe("completed");

      // Verify final progress shows all phases completed
      const progress = await harness.executionService.getRunProgress(
        harness.paths,
        run.runId,
      );
      expect(progress.phases.every((p) => p.status === "completed")).toBe(true);
    });
  });
});
