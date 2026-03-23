import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import { ObjectiveService } from "../../packages/core/src/core/objectives/index.js";
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
  objectiveService: ObjectiveService;
  paths: OpenGoatPaths;
}> {
  const root = await createTempDir("opengoat-objective-service-");
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

  const objectiveService = new ObjectiveService({
    fileSystem,
    pathPort,
    nowIso: options?.nowIso ?? (() => new Date().toISOString()),
  });

  return { objectiveService, paths };
}

describe("ObjectiveService", () => {
  it("creates objective with defaults populated", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-01T10:00:00.000Z",
    });

    const objective = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "Launch on Product Hunt" },
    );

    expect(objective.objectiveId).toBeTruthy();
    expect(objective.projectId).toBe("project-1");
    expect(objective.title).toBe("Launch on Product Hunt");
    expect(objective.status).toBe("draft");
    expect(objective.isPrimary).toBe(false);
    expect(objective.goalType).toBe("");
    expect(objective.summary).toBe("");
    expect(objective.createdFrom).toBe("manual");
    expect(objective.createdAt).toBe("2026-03-01T10:00:00.000Z");
    expect(objective.updatedAt).toBe("2026-03-01T10:00:00.000Z");
    expect(objective.archivedAt).toBeUndefined();
  });

  it("gets objective by ID", async () => {
    const harness = await createHarness();

    const created = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "Improve homepage conversion" },
    );

    const fetched = await harness.objectiveService.get(
      harness.paths,
      created.objectiveId,
    );

    expect(fetched.objectiveId).toBe(created.objectiveId);
    expect(fetched.title).toBe("Improve homepage conversion");
    expect(fetched.projectId).toBe("project-1");
  });

  it("throws when getting non-existent objective", async () => {
    const harness = await createHarness();

    await expect(
      harness.objectiveService.get(harness.paths, "non-existent-id"),
    ).rejects.toThrow("Objective not found");
  });

  it("lists objectives filtered by projectId", async () => {
    const harness = await createHarness();

    await harness.objectiveService.create(harness.paths, "project-1", {
      title: "Objective A",
    });
    await harness.objectiveService.create(harness.paths, "project-1", {
      title: "Objective B",
    });
    await harness.objectiveService.create(harness.paths, "project-2", {
      title: "Objective C",
    });

    const project1Objectives = await harness.objectiveService.list(
      harness.paths,
      { projectId: "project-1" },
    );

    expect(project1Objectives).toHaveLength(2);
    expect(project1Objectives.map((o) => o.title).sort()).toEqual([
      "Objective A",
      "Objective B",
    ]);
  });

  it("lists objectives filtered by status", async () => {
    const harness = await createHarness();

    const obj1 = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "Draft Objective" },
    );
    const obj2 = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "Active Objective" },
    );

    await harness.objectiveService.update(harness.paths, obj2.objectiveId, {
      status: "active",
    });

    const activeOnly = await harness.objectiveService.list(harness.paths, {
      projectId: "project-1",
      status: "active",
    });

    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].title).toBe("Active Objective");
  });

  it("updates objective partial fields", async () => {
    const now = "2026-03-01T10:00:00.000Z";
    const later = "2026-03-01T12:00:00.000Z";
    let currentTime = now;

    const harness = await createHarness({
      nowIso: () => currentTime,
    });

    const created = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "Original Title", summary: "Original summary" },
    );

    currentTime = later;

    const updated = await harness.objectiveService.update(
      harness.paths,
      created.objectiveId,
      { title: "Updated Title", whyNow: "Because it matters" },
    );

    expect(updated.title).toBe("Updated Title");
    expect(updated.summary).toBe("Original summary");
    expect(updated.whyNow).toBe("Because it matters");
    expect(updated.updatedAt).toBe(later);
    expect(updated.createdAt).toBe(now);
  });

  it("archives objective setting archivedAt and status", async () => {
    const now = "2026-03-01T10:00:00.000Z";
    const archiveTime = "2026-03-05T15:00:00.000Z";
    let currentTime = now;

    const harness = await createHarness({
      nowIso: () => currentTime,
    });

    const created = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "To be archived" },
    );

    currentTime = archiveTime;

    const archived = await harness.objectiveService.archive(
      harness.paths,
      created.objectiveId,
    );

    expect(archived.status).toBe("abandoned");
    expect(archived.archivedAt).toBe(archiveTime);
    expect(archived.updatedAt).toBe(archiveTime);
  });

  it("setPrimaryActive clears previous primary", async () => {
    const harness = await createHarness();

    const obj1 = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "First Objective" },
    );
    const obj2 = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "Second Objective" },
    );

    await harness.objectiveService.setPrimaryActive(
      harness.paths,
      "project-1",
      obj1.objectiveId,
    );

    const primary1 = await harness.objectiveService.get(
      harness.paths,
      obj1.objectiveId,
    );
    expect(primary1.isPrimary).toBe(true);
    expect(primary1.status).toBe("active");

    await harness.objectiveService.setPrimaryActive(
      harness.paths,
      "project-1",
      obj2.objectiveId,
    );

    const updatedObj1 = await harness.objectiveService.get(
      harness.paths,
      obj1.objectiveId,
    );
    const updatedObj2 = await harness.objectiveService.get(
      harness.paths,
      obj2.objectiveId,
    );

    expect(updatedObj1.isPrimary).toBe(false);
    expect(updatedObj2.isPrimary).toBe(true);
    expect(updatedObj2.status).toBe("active");
  });

  it("setPrimaryActive on non-existent objective throws", async () => {
    const harness = await createHarness();

    await expect(
      harness.objectiveService.setPrimaryActive(
        harness.paths,
        "project-1",
        "non-existent-id",
      ),
    ).rejects.toThrow("Objective not found");
  });

  it("only one primary per project after multiple setPrimaryActive calls", async () => {
    const harness = await createHarness();

    const obj1 = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "Obj 1" },
    );
    const obj2 = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "Obj 2" },
    );
    const obj3 = await harness.objectiveService.create(
      harness.paths,
      "project-1",
      { title: "Obj 3" },
    );

    await harness.objectiveService.setPrimaryActive(
      harness.paths,
      "project-1",
      obj1.objectiveId,
    );
    await harness.objectiveService.setPrimaryActive(
      harness.paths,
      "project-1",
      obj2.objectiveId,
    );
    await harness.objectiveService.setPrimaryActive(
      harness.paths,
      "project-1",
      obj3.objectiveId,
    );

    const all = await harness.objectiveService.list(harness.paths, {
      projectId: "project-1",
    });

    const primaries = all.filter((o) => o.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].objectiveId).toBe(obj3.objectiveId);
  });
});
