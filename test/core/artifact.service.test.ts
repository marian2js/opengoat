import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { ArtifactService } from "../../packages/core/src/core/artifacts/application/artifact.service.js";
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
  artifactService: ArtifactService;
  paths: OpenGoatPaths;
}> {
  const root = await createTempDir("opengoat-artifact-service-");
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

  const artifactService = new ArtifactService({
    fileSystem,
    pathPort,
    nowIso: options?.nowIso ?? (() => new Date().toISOString()),
  });

  return { artifactService, paths };
}

// ---------------------------------------------------------------------------
// createArtifact tests
// ---------------------------------------------------------------------------

describe("ArtifactService", () => {
  describe("createArtifact", () => {
    it("creates artifact with correct fields and defaults", async () => {
      const harness = await createHarness({
        nowIso: () => "2026-03-01T10:00:00.000Z",
      });

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Product Hunt Launch Copy",
          type: "copy_draft",
          format: "markdown",
          contentRef: "artifacts/launch-copy.md",
          createdBy: "goat",
        },
      );

      expect(artifact.artifactId).toMatch(/^art-/);
      expect(artifact.projectId).toBe("project-1");
      expect(artifact.title).toBe("Product Hunt Launch Copy");
      expect(artifact.type).toBe("copy_draft");
      expect(artifact.format).toBe("markdown");
      expect(artifact.contentRef).toBe("artifacts/launch-copy.md");
      expect(artifact.createdBy).toBe("goat");
      expect(artifact.status).toBe("draft");
      expect(artifact.version).toBe(1);
      expect(artifact.createdAt).toBe("2026-03-01T10:00:00.000Z");
      expect(artifact.updatedAt).toBe("2026-03-01T10:00:00.000Z");
      expect(artifact.objectiveId).toBeUndefined();
      expect(artifact.runId).toBeUndefined();
      expect(artifact.taskId).toBeUndefined();
      expect(artifact.bundleId).toBeUndefined();
      expect(artifact.approvedAt).toBeUndefined();
      expect(artifact.approvedBy).toBeUndefined();
    });

    it("creates artifact with all optional linking fields", async () => {
      const harness = await createHarness();

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Content Calendar",
          type: "content_calendar",
          format: "json",
          contentRef: "artifacts/calendar.json",
          createdBy: "goat",
          objectiveId: "obj-1",
          runId: "run-1",
          taskId: "task-1",
          bundleId: "bnd-1",
          content: '{"weeks": []}',
          summary: "A 2-week content calendar",
        },
      );

      expect(artifact.objectiveId).toBe("obj-1");
      expect(artifact.runId).toBe("run-1");
      expect(artifact.taskId).toBe("task-1");
      expect(artifact.bundleId).toBe("bnd-1");
      expect(artifact.content).toBe('{"weeks": []}');
      expect(artifact.summary).toBe("A 2-week content calendar");
    });

    it("creates initial version snapshot on creation", async () => {
      const harness = await createHarness({
        nowIso: () => "2026-03-01T10:00:00.000Z",
      });

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Test Artifact",
          type: "checklist",
          format: "markdown",
          contentRef: "artifacts/checklist.md",
          createdBy: "goat",
          content: "# Checklist\n- Item 1",
        },
      );

      const versions = await harness.artifactService.getVersionHistory(
        harness.paths,
        artifact.artifactId,
      );

      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
      expect(versions[0].content).toBe("# Checklist\n- Item 1");
      expect(versions[0].contentRef).toBe("artifacts/checklist.md");
      expect(versions[0].createdBy).toBe("goat");
      expect(versions[0].createdAt).toBe("2026-03-01T10:00:00.000Z");
    });

    it("throws with empty title", async () => {
      const harness = await createHarness();

      await expect(
        harness.artifactService.createArtifact(harness.paths, {
          projectId: "project-1",
          title: "  ",
          type: "report",
          format: "markdown",
          contentRef: "ref",
          createdBy: "goat",
        }),
      ).rejects.toThrow("Artifact title must not be empty");
    });

    it("throws with empty projectId", async () => {
      const harness = await createHarness();

      await expect(
        harness.artifactService.createArtifact(harness.paths, {
          projectId: "",
          title: "Valid Title",
          type: "report",
          format: "markdown",
          contentRef: "ref",
          createdBy: "goat",
        }),
      ).rejects.toThrow("Artifact projectId must not be empty");
    });

    it("throws with empty contentRef", async () => {
      const harness = await createHarness();

      await expect(
        harness.artifactService.createArtifact(harness.paths, {
          projectId: "project-1",
          title: "Valid Title",
          type: "report",
          format: "markdown",
          contentRef: "  ",
          createdBy: "goat",
        }),
      ).rejects.toThrow("Artifact contentRef must not be empty");
    });

    it("throws with empty createdBy", async () => {
      const harness = await createHarness();

      await expect(
        harness.artifactService.createArtifact(harness.paths, {
          projectId: "project-1",
          title: "Valid Title",
          type: "report",
          format: "markdown",
          contentRef: "ref",
          createdBy: "",
        }),
      ).rejects.toThrow("Artifact createdBy must not be empty");
    });
  });

  // ---------------------------------------------------------------------------
  // getArtifact tests
  // ---------------------------------------------------------------------------

  describe("getArtifact", () => {
    it("retrieves a created artifact", async () => {
      const harness = await createHarness();

      const created = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Competitor Matrix",
          type: "matrix",
          format: "csv",
          contentRef: "artifacts/matrix.csv",
          createdBy: "goat",
        },
      );

      const fetched = await harness.artifactService.getArtifact(
        harness.paths,
        created.artifactId,
      );

      expect(fetched.artifactId).toBe(created.artifactId);
      expect(fetched.title).toBe("Competitor Matrix");
      expect(fetched.type).toBe("matrix");
    });

    it("throws for non-existent artifactId", async () => {
      const harness = await createHarness();

      await expect(
        harness.artifactService.getArtifact(harness.paths, "non-existent-id"),
      ).rejects.toThrow("Artifact not found");
    });
  });

  // ---------------------------------------------------------------------------
  // listArtifacts tests
  // ---------------------------------------------------------------------------

  describe("listArtifacts", () => {
    it("filters by projectId", async () => {
      const harness = await createHarness();

      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "A",
        type: "report",
        format: "markdown",
        contentRef: "a",
        createdBy: "goat",
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "B",
        type: "report",
        format: "markdown",
        contentRef: "b",
        createdBy: "goat",
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-2",
        title: "C",
        type: "report",
        format: "markdown",
        contentRef: "c",
        createdBy: "goat",
      });

      const result = await harness.artifactService.listArtifacts(
        harness.paths,
        { projectId: "project-1" },
      );

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters by status", async () => {
      const harness = await createHarness();

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "A",
          type: "report",
          format: "markdown",
          contentRef: "a",
          createdBy: "goat",
        },
      );
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "B",
        type: "report",
        format: "markdown",
        contentRef: "b",
        createdBy: "goat",
      });

      await harness.artifactService.updateArtifactStatus(
        harness.paths,
        artifact.artifactId,
        "ready_for_review",
      );

      const result = await harness.artifactService.listArtifacts(
        harness.paths,
        { status: "ready_for_review" },
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("A");
    });

    it("filters by objectiveId", async () => {
      const harness = await createHarness();

      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-1",
        title: "A",
        type: "report",
        format: "markdown",
        contentRef: "a",
        createdBy: "goat",
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        objectiveId: "obj-2",
        title: "B",
        type: "report",
        format: "markdown",
        contentRef: "b",
        createdBy: "goat",
      });

      const result = await harness.artifactService.listArtifacts(
        harness.paths,
        { objectiveId: "obj-1" },
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("A");
    });

    it("filters by runId", async () => {
      const harness = await createHarness();

      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        runId: "run-1",
        title: "A",
        type: "report",
        format: "markdown",
        contentRef: "a",
        createdBy: "goat",
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        runId: "run-2",
        title: "B",
        type: "report",
        format: "markdown",
        contentRef: "b",
        createdBy: "goat",
      });

      const result = await harness.artifactService.listArtifacts(
        harness.paths,
        { runId: "run-1" },
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("A");
    });

    it("filters by bundleId", async () => {
      const harness = await createHarness();

      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        bundleId: "bnd-1",
        title: "A",
        type: "report",
        format: "markdown",
        contentRef: "a",
        createdBy: "goat",
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "B",
        type: "report",
        format: "markdown",
        contentRef: "b",
        createdBy: "goat",
      });

      const result = await harness.artifactService.listArtifacts(
        harness.paths,
        { bundleId: "bnd-1" },
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("A");
    });

    it("returns total count", async () => {
      const harness = await createHarness();

      for (let i = 0; i < 5; i++) {
        await harness.artifactService.createArtifact(harness.paths, {
          projectId: "project-1",
          title: `Artifact ${i}`,
          type: "report",
          format: "markdown",
          contentRef: `ref-${i}`,
          createdBy: "goat",
        });
      }

      const result = await harness.artifactService.listArtifacts(
        harness.paths,
        { projectId: "project-1" },
      );

      expect(result.total).toBe(5);
      expect(result.items).toHaveLength(5);
    });

    it("returns empty list when no matches", async () => {
      const harness = await createHarness();

      const result = await harness.artifactService.listArtifacts(
        harness.paths,
        { projectId: "non-existent" },
      );

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // updateArtifact tests
  // ---------------------------------------------------------------------------

  describe("updateArtifact", () => {
    it("increments version on update", async () => {
      const harness = await createHarness();

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Test",
          type: "copy_draft",
          format: "markdown",
          contentRef: "ref",
          createdBy: "goat",
          content: "v1 content",
        },
      );

      expect(artifact.version).toBe(1);

      const updated = await harness.artifactService.updateArtifact(
        harness.paths,
        artifact.artifactId,
        { content: "v2 content" },
      );

      expect(updated.version).toBe(2);
      expect(updated.content).toBe("v2 content");
    });

    it("creates new version row in history", async () => {
      const harness = await createHarness();

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Test",
          type: "copy_draft",
          format: "markdown",
          contentRef: "ref",
          createdBy: "goat",
          content: "v1",
        },
      );

      await harness.artifactService.updateArtifact(
        harness.paths,
        artifact.artifactId,
        { content: "v2" },
      );

      const versions = await harness.artifactService.getVersionHistory(
        harness.paths,
        artifact.artifactId,
      );

      expect(versions).toHaveLength(2);
      // Ordered by version DESC
      expect(versions[0].version).toBe(2);
      expect(versions[0].content).toBe("v2");
      expect(versions[1].version).toBe(1);
      expect(versions[1].content).toBe("v1");
    });

    it("updates content, contentRef, summary, and title fields", async () => {
      const harness = await createHarness();

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Original Title",
          type: "copy_draft",
          format: "markdown",
          contentRef: "original-ref",
          createdBy: "goat",
          content: "original content",
          summary: "original summary",
        },
      );

      const updated = await harness.artifactService.updateArtifact(
        harness.paths,
        artifact.artifactId,
        {
          title: "Updated Title",
          content: "updated content",
          contentRef: "updated-ref",
          summary: "updated summary",
        },
      );

      expect(updated.title).toBe("Updated Title");
      expect(updated.content).toBe("updated content");
      expect(updated.contentRef).toBe("updated-ref");
      expect(updated.summary).toBe("updated summary");
    });

    it("preserves original version in history", async () => {
      const harness = await createHarness();

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Test",
          type: "copy_draft",
          format: "markdown",
          contentRef: "ref-v1",
          createdBy: "goat",
          content: "original content",
        },
      );

      await harness.artifactService.updateArtifact(
        harness.paths,
        artifact.artifactId,
        { content: "new content", contentRef: "ref-v2" },
      );

      const versions = await harness.artifactService.getVersionHistory(
        harness.paths,
        artifact.artifactId,
      );

      const v1 = versions.find((v) => v.version === 1);
      expect(v1).toBeDefined();
      expect(v1!.content).toBe("original content");
      expect(v1!.contentRef).toBe("ref-v1");
    });

    it("updates updatedAt timestamp", async () => {
      const now = "2026-03-01T10:00:00.000Z";
      const later = "2026-03-01T12:00:00.000Z";
      let currentTime = now;

      const harness = await createHarness({
        nowIso: () => currentTime,
      });

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Test",
          type: "copy_draft",
          format: "markdown",
          contentRef: "ref",
          createdBy: "goat",
        },
      );

      expect(artifact.updatedAt).toBe(now);

      currentTime = later;
      const updated = await harness.artifactService.updateArtifact(
        harness.paths,
        artifact.artifactId,
        { content: "new" },
      );

      expect(updated.updatedAt).toBe(later);
      expect(updated.createdAt).toBe(now);
    });

    it("throws for non-existent artifact", async () => {
      const harness = await createHarness();

      await expect(
        harness.artifactService.updateArtifact(
          harness.paths,
          "non-existent",
          { content: "new" },
        ),
      ).rejects.toThrow("Artifact not found");
    });
  });

  // ---------------------------------------------------------------------------
  // updateArtifactStatus tests
  // ---------------------------------------------------------------------------

  describe("updateArtifactStatus", () => {
    it("valid transition succeeds (draft -> ready_for_review)", async () => {
      const harness = await createHarness();

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Test",
          type: "report",
          format: "markdown",
          contentRef: "ref",
          createdBy: "goat",
        },
      );

      const updated = await harness.artifactService.updateArtifactStatus(
        harness.paths,
        artifact.artifactId,
        "ready_for_review",
      );

      expect(updated.status).toBe("ready_for_review");
    });

    it("invalid transition throws (draft -> approved)", async () => {
      const harness = await createHarness();

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Test",
          type: "report",
          format: "markdown",
          contentRef: "ref",
          createdBy: "goat",
        },
      );

      await expect(
        harness.artifactService.updateArtifactStatus(
          harness.paths,
          artifact.artifactId,
          "approved",
        ),
      ).rejects.toThrow(
        'Invalid artifact status transition from "draft" to "approved"',
      );
    });

    it("approval sets approvedAt and approvedBy", async () => {
      const now = "2026-03-01T10:00:00.000Z";
      const later = "2026-03-01T12:00:00.000Z";
      let currentTime = now;

      const harness = await createHarness({
        nowIso: () => currentTime,
      });

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Test",
          type: "report",
          format: "markdown",
          contentRef: "ref",
          createdBy: "goat",
        },
      );

      await harness.artifactService.updateArtifactStatus(
        harness.paths,
        artifact.artifactId,
        "ready_for_review",
      );

      currentTime = later;
      const approved = await harness.artifactService.updateArtifactStatus(
        harness.paths,
        artifact.artifactId,
        "approved",
        "reviewer-user",
      );

      expect(approved.status).toBe("approved");
      expect(approved.approvedAt).toBe(later);
      expect(approved.approvedBy).toBe("reviewer-user");
    });

    it("archived from any non-terminal status works", async () => {
      const harness = await createHarness();

      // draft -> archived
      const a1 = await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "A1",
        type: "report",
        format: "markdown",
        contentRef: "ref",
        createdBy: "goat",
      });
      const archived1 = await harness.artifactService.updateArtifactStatus(
        harness.paths,
        a1.artifactId,
        "archived",
      );
      expect(archived1.status).toBe("archived");

      // ready_for_review -> archived
      const a2 = await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "A2",
        type: "report",
        format: "markdown",
        contentRef: "ref",
        createdBy: "goat",
      });
      await harness.artifactService.updateArtifactStatus(
        harness.paths,
        a2.artifactId,
        "ready_for_review",
      );
      const archived2 = await harness.artifactService.updateArtifactStatus(
        harness.paths,
        a2.artifactId,
        "archived",
      );
      expect(archived2.status).toBe("archived");

      // approved -> archived
      const a3 = await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "A3",
        type: "report",
        format: "markdown",
        contentRef: "ref",
        createdBy: "goat",
      });
      await harness.artifactService.updateArtifactStatus(
        harness.paths,
        a3.artifactId,
        "ready_for_review",
      );
      await harness.artifactService.updateArtifactStatus(
        harness.paths,
        a3.artifactId,
        "approved",
      );
      const archived3 = await harness.artifactService.updateArtifactStatus(
        harness.paths,
        a3.artifactId,
        "archived",
      );
      expect(archived3.status).toBe("archived");
    });

    it("throws for non-existent artifact", async () => {
      const harness = await createHarness();

      await expect(
        harness.artifactService.updateArtifactStatus(
          harness.paths,
          "non-existent",
          "ready_for_review",
        ),
      ).rejects.toThrow("Artifact not found");
    });
  });

  // ---------------------------------------------------------------------------
  // getVersionHistory tests
  // ---------------------------------------------------------------------------

  describe("getVersionHistory", () => {
    it("returns all versions ordered by version DESC", async () => {
      const harness = await createHarness();

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Test",
          type: "copy_draft",
          format: "markdown",
          contentRef: "ref",
          createdBy: "goat",
          content: "v1",
        },
      );

      await harness.artifactService.updateArtifact(
        harness.paths,
        artifact.artifactId,
        { content: "v2" },
      );
      await harness.artifactService.updateArtifact(
        harness.paths,
        artifact.artifactId,
        { content: "v3" },
      );

      const versions = await harness.artifactService.getVersionHistory(
        harness.paths,
        artifact.artifactId,
      );

      expect(versions).toHaveLength(3);
      expect(versions[0].version).toBe(3);
      expect(versions[1].version).toBe(2);
      expect(versions[2].version).toBe(1);
    });

    it("version count matches update count + 1 (initial)", async () => {
      const harness = await createHarness();

      const artifact = await harness.artifactService.createArtifact(
        harness.paths,
        {
          projectId: "project-1",
          title: "Test",
          type: "copy_draft",
          format: "markdown",
          contentRef: "ref",
          createdBy: "goat",
          content: "v1",
        },
      );

      // 3 updates
      for (let i = 2; i <= 4; i++) {
        await harness.artifactService.updateArtifact(
          harness.paths,
          artifact.artifactId,
          { content: `v${i}` },
        );
      }

      const versions = await harness.artifactService.getVersionHistory(
        harness.paths,
        artifact.artifactId,
      );

      expect(versions).toHaveLength(4); // 1 initial + 3 updates
    });

    it("throws for non-existent artifact", async () => {
      const harness = await createHarness();

      await expect(
        harness.artifactService.getVersionHistory(
          harness.paths,
          "non-existent",
        ),
      ).rejects.toThrow("Artifact not found");
    });
  });

  // ---------------------------------------------------------------------------
  // createBundle tests
  // ---------------------------------------------------------------------------

  describe("createBundle", () => {
    it("creates bundle with correct fields", async () => {
      const harness = await createHarness({
        nowIso: () => "2026-03-01T10:00:00.000Z",
      });

      const bundle = await harness.artifactService.createBundle(
        harness.paths,
        {
          projectId: "project-1",
          title: "Launch Pack",
          description: "All launch-related artifacts",
        },
      );

      expect(bundle.bundleId).toMatch(/^bnd-/);
      expect(bundle.projectId).toBe("project-1");
      expect(bundle.title).toBe("Launch Pack");
      expect(bundle.description).toBe("All launch-related artifacts");
      expect(bundle.createdAt).toBe("2026-03-01T10:00:00.000Z");
      expect(bundle.updatedAt).toBe("2026-03-01T10:00:00.000Z");
    });

    it("creates bundle without description", async () => {
      const harness = await createHarness();

      const bundle = await harness.artifactService.createBundle(
        harness.paths,
        {
          projectId: "project-1",
          title: "Content Sprint",
        },
      );

      expect(bundle.title).toBe("Content Sprint");
      expect(bundle.description).toBeUndefined();
    });

    it("throws with empty title", async () => {
      const harness = await createHarness();

      await expect(
        harness.artifactService.createBundle(harness.paths, {
          projectId: "project-1",
          title: "  ",
        }),
      ).rejects.toThrow("Bundle title must not be empty");
    });

    it("throws with empty projectId", async () => {
      const harness = await createHarness();

      await expect(
        harness.artifactService.createBundle(harness.paths, {
          projectId: "",
          title: "Valid Title",
        }),
      ).rejects.toThrow("Bundle projectId must not be empty");
    });
  });

  // ---------------------------------------------------------------------------
  // listBundleArtifacts tests
  // ---------------------------------------------------------------------------

  describe("listBundleArtifacts", () => {
    it("returns only artifacts with matching bundleId", async () => {
      const harness = await createHarness();

      const bundle = await harness.artifactService.createBundle(
        harness.paths,
        { projectId: "project-1", title: "Launch Pack" },
      );

      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        bundleId: bundle.bundleId,
        title: "Launch Copy",
        type: "copy_draft",
        format: "markdown",
        contentRef: "ref1",
        createdBy: "goat",
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        bundleId: bundle.bundleId,
        title: "Launch Checklist",
        type: "checklist",
        format: "markdown",
        contentRef: "ref2",
        createdBy: "goat",
      });
      await harness.artifactService.createArtifact(harness.paths, {
        projectId: "project-1",
        title: "Unrelated Artifact",
        type: "report",
        format: "markdown",
        contentRef: "ref3",
        createdBy: "goat",
      });

      const bundleArtifacts =
        await harness.artifactService.listBundleArtifacts(
          harness.paths,
          bundle.bundleId,
        );

      expect(bundleArtifacts).toHaveLength(2);
      expect(bundleArtifacts.map((a) => a.title).sort()).toEqual([
        "Launch Checklist",
        "Launch Copy",
      ]);
    });

    it("returns empty when no artifacts match", async () => {
      const harness = await createHarness();

      const result = await harness.artifactService.listBundleArtifacts(
        harness.paths,
        "non-existent-bundle",
      );

      expect(result).toHaveLength(0);
    });
  });
});
