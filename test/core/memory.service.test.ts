import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryService } from "../../packages/core/src/core/memory/index.js";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
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

async function createHarness(options?: { nowIso?: () => string }) {
  const root = await createTempDir("memory-service-test-");
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

describe("MemoryService", () => {
  it("creates a memory entry with all fields populated", async () => {
    const harness = await createHarness({
      nowIso: () => "2026-03-01T10:00:00.000Z",
    });

    const memory = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "Casual and friendly tone",
      source: "user",
      createdBy: "goat",
    });

    expect(memory.memoryId).toBeTruthy();
    expect(memory.projectId).toBe("proj-1");
    expect(memory.objectiveId).toBeNull();
    expect(memory.category).toBe("brand_voice");
    expect(memory.scope).toBe("project");
    expect(memory.content).toBe("Casual and friendly tone");
    expect(memory.source).toBe("user");
    expect(memory.confidence).toBe(1.0);
    expect(memory.createdBy).toBe("goat");
    expect(memory.createdAt).toBe("2026-03-01T10:00:00.000Z");
    expect(memory.updatedAt).toBe("2026-03-01T10:00:00.000Z");
    expect(memory.userConfirmed).toBe(false);
    expect(memory.supersedes).toBeNull();
    expect(memory.replacedBy).toBeNull();
  });

  it("retrieves a memory by ID", async () => {
    const harness = await createHarness();

    const created = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "product_facts",
      scope: "project",
      content: "SaaS product for marketers",
      source: "chat",
      createdBy: "goat",
    });

    const retrieved = await harness.memoryService.getMemory(
      harness.paths,
      created.memoryId,
    );

    expect(retrieved).toBeDefined();
    expect(retrieved!.memoryId).toBe(created.memoryId);
    expect(retrieved!.content).toBe("SaaS product for marketers");
  });

  it("returns undefined for nonexistent memory ID", async () => {
    const harness = await createHarness();

    const result = await harness.memoryService.getMemory(
      harness.paths,
      "nonexistent-id",
    );

    expect(result).toBeUndefined();
  });

  it("lists memories by projectId", async () => {
    const harness = await createHarness();

    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "Voice 1",
      source: "user",
      createdBy: "goat",
    });
    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "product_facts",
      scope: "project",
      content: "Fact 1",
      source: "user",
      createdBy: "goat",
    });
    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-2",
      category: "brand_voice",
      scope: "project",
      content: "Voice 2",
      source: "user",
      createdBy: "goat",
    });

    const proj1Memories = await harness.memoryService.listMemories(
      harness.paths,
      { projectId: "proj-1" },
    );

    expect(proj1Memories).toHaveLength(2);
    expect(proj1Memories.every((m) => m.projectId === "proj-1")).toBe(true);
  });

  it("filters memories by objectiveId, category, and scope", async () => {
    const harness = await createHarness();

    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "current_goal",
      scope: "objective",
      content: "Launch on PH",
      source: "user",
      createdBy: "goat",
      objectiveId: "obj-1",
    });
    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "Friendly tone",
      source: "user",
      createdBy: "goat",
    });
    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "success_definition",
      scope: "objective",
      content: "500 upvotes",
      source: "user",
      createdBy: "goat",
      objectiveId: "obj-1",
    });

    const objectiveMemories = await harness.memoryService.listMemories(
      harness.paths,
      { projectId: "proj-1", objectiveId: "obj-1" },
    );
    expect(objectiveMemories).toHaveLength(2);

    const categoryFiltered = await harness.memoryService.listMemories(
      harness.paths,
      { projectId: "proj-1", category: "brand_voice" },
    );
    expect(categoryFiltered).toHaveLength(1);
    expect(categoryFiltered[0]!.content).toBe("Friendly tone");

    const scopeFiltered = await harness.memoryService.listMemories(
      harness.paths,
      { projectId: "proj-1", scope: "objective" },
    );
    expect(scopeFiltered).toHaveLength(2);
  });

  it("filters out replaced entries with activeOnly (default true)", async () => {
    const harness = await createHarness();

    const old = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "Old voice",
      source: "user",
      createdBy: "goat",
    });
    const newer = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "New voice",
      source: "user",
      createdBy: "goat",
    });

    await harness.memoryService.resolveConflict(
      harness.paths,
      newer.memoryId,
      old.memoryId,
    );

    const activeList = await harness.memoryService.listMemories(harness.paths, {
      projectId: "proj-1",
    });
    expect(activeList).toHaveLength(1);
    expect(activeList[0]!.content).toBe("New voice");

    const allList = await harness.memoryService.listMemories(harness.paths, {
      projectId: "proj-1",
      activeOnly: false,
    });
    expect(allList).toHaveLength(2);
  });

  it("updates memory content and confidence", async () => {
    let time = "2026-03-01T10:00:00.000Z";
    const harness = await createHarness({ nowIso: () => time });

    const created = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "Old content",
      source: "user",
      createdBy: "goat",
      confidence: 0.5,
    });

    time = "2026-03-01T11:00:00.000Z";
    const updated = await harness.memoryService.updateMemory(
      harness.paths,
      created.memoryId,
      { content: "New content", confidence: 0.9 },
    );

    expect(updated.content).toBe("New content");
    expect(updated.confidence).toBe(0.9);
    expect(updated.updatedAt).toBe("2026-03-01T11:00:00.000Z");
    expect(updated.createdAt).toBe("2026-03-01T10:00:00.000Z");
    expect(updated.source).toBe("user");
  });

  it("throws when updating nonexistent memory", async () => {
    const harness = await createHarness();

    await expect(
      harness.memoryService.updateMemory(harness.paths, "nonexistent-id", {
        content: "Updated",
      }),
    ).rejects.toThrow();
  });

  it("deletes a memory entry", async () => {
    const harness = await createHarness();

    const created = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "To delete",
      source: "user",
      createdBy: "goat",
    });

    await harness.memoryService.deleteMemory(harness.paths, created.memoryId);

    const result = await harness.memoryService.getMemory(
      harness.paths,
      created.memoryId,
    );
    expect(result).toBeUndefined();
  });

  it("throws when deleting nonexistent memory", async () => {
    const harness = await createHarness();

    await expect(
      harness.memoryService.deleteMemory(harness.paths, "nonexistent-id"),
    ).rejects.toThrow();
  });

  it("detects conflicts in same category and scope", async () => {
    const harness = await createHarness();

    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "Voice A",
      source: "user",
      createdBy: "goat",
    });
    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "Voice B",
      source: "chat",
      createdBy: "goat",
    });

    const conflicts = await harness.memoryService.detectConflicts(
      harness.paths,
      "proj-1",
      "project",
      "brand_voice",
    );

    expect(conflicts).toHaveLength(2);
  });

  it("resolves a conflict by linking supersedes and replacedBy", async () => {
    const harness = await createHarness();

    const old = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "Old voice",
      source: "user",
      createdBy: "goat",
    });
    const newer = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "New voice",
      source: "user",
      createdBy: "goat",
    });

    await harness.memoryService.resolveConflict(
      harness.paths,
      newer.memoryId,
      old.memoryId,
    );

    const oldEntry = await harness.memoryService.getMemory(
      harness.paths,
      old.memoryId,
    );
    const newEntry = await harness.memoryService.getMemory(
      harness.paths,
      newer.memoryId,
    );

    expect(oldEntry!.replacedBy).toBe(newer.memoryId);
    expect(newEntry!.supersedes).toBe(old.memoryId);

    const active = await harness.memoryService.listMemories(harness.paths, {
      projectId: "proj-1",
    });
    expect(active).toHaveLength(1);
    expect(active[0]!.memoryId).toBe(newer.memoryId);
  });
});
