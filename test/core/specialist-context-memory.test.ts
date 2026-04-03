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
  const root = await createTempDir("specialist-context-test-");
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

describe("MemoryService — specialist_context support", () => {
  it("creates a memory with specialist_context category and specialistId", async () => {
    const harness = await createHarness();

    const memory = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      scope: "project",
      content: "Prioritize long-tail keywords over brand terms",
      source: "user",
      createdBy: "user",
      specialistId: "seo-aeo",
    });

    expect(memory.memoryId).toBeTruthy();
    expect(memory.projectId).toBe("proj-1");
    expect(memory.category).toBe("specialist_context");
    expect(memory.scope).toBe("project");
    expect(memory.content).toBe("Prioritize long-tail keywords over brand terms");
    expect(memory.specialistId).toBe("seo-aeo");
  });

  it("creates a memory without specialistId (defaults to null)", async () => {
    const harness = await createHarness();

    const memory = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "brand_voice",
      scope: "project",
      content: "Casual tone",
      source: "user",
      createdBy: "user",
    });

    expect(memory.specialistId).toBeNull();
  });

  it("lists memories filtered by specialistId", async () => {
    const harness = await createHarness();

    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      scope: "project",
      content: "SEO guideline 1",
      source: "user",
      createdBy: "user",
      specialistId: "seo-aeo",
    });
    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      scope: "project",
      content: "Outbound guideline 1",
      source: "user",
      createdBy: "user",
      specialistId: "outbound",
    });
    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      scope: "project",
      content: "SEO guideline 2",
      source: "user",
      createdBy: "user",
      specialistId: "seo-aeo",
    });

    const seoEntries = await harness.memoryService.listMemories(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      specialistId: "seo-aeo",
    });

    expect(seoEntries).toHaveLength(2);
    expect(seoEntries.every((e) => e.specialistId === "seo-aeo")).toBe(true);
  });

  it("lists all specialist_context memories when specialistId is not provided", async () => {
    const harness = await createHarness();

    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      scope: "project",
      content: "SEO guideline",
      source: "user",
      createdBy: "user",
      specialistId: "seo-aeo",
    });
    await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      scope: "project",
      content: "Outbound guideline",
      source: "user",
      createdBy: "user",
      specialistId: "outbound",
    });

    const allSpecialistEntries = await harness.memoryService.listMemories(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
    });

    expect(allSpecialistEntries).toHaveLength(2);
  });

  it("round-trips specialistId through create and get", async () => {
    const harness = await createHarness();

    const created = await harness.memoryService.createMemory(harness.paths, {
      projectId: "proj-1",
      category: "specialist_context",
      scope: "project",
      content: "Use casual founder tone",
      source: "user",
      createdBy: "user",
      specialistId: "outbound",
    });

    const retrieved = await harness.memoryService.getMemory(
      harness.paths,
      created.memoryId,
    );

    expect(retrieved).toBeDefined();
    expect(retrieved!.specialistId).toBe("outbound");
  });
});
