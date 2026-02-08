import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { WorkbenchState } from "@shared/workbench";
import { WorkbenchStore } from "./workbench-store";

const tempRoots: string[] = [];

afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

describe("WorkbenchStore", () => {
  it("creates an implicit Home project by default", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opengoat-desktop-store-"));
    tempRoots.push(root);
    const stateFilePath = path.join(root, "state.json");
    const store = new WorkbenchStore({
      stateFilePath,
      nowIso: () => "2026-02-08T00:00:00.000Z"
    });

    const projects = await store.listProjects();
    const home = projects.find((project) => project.name === "Home");

    expect(home).toBeTruthy();
    expect(home?.rootPath).toBe(path.resolve(os.homedir()));
    expect(projects[0]?.name).toBe("Home");
  });

  it("injects Home project into existing desktop state files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opengoat-desktop-store-"));
    tempRoots.push(root);
    const stateFilePath = path.join(root, "state.json");

    const existingState: WorkbenchState = {
      schemaVersion: 1,
      createdAt: "2026-02-08T00:00:00.000Z",
      updatedAt: "2026-02-08T00:00:00.000Z",
      projects: [
        {
          id: "project-1",
          name: "workspace",
          rootPath: "/tmp/workspace",
          createdAt: "2026-02-08T00:00:00.000Z",
          updatedAt: "2026-02-08T00:00:00.000Z",
          sessions: []
        }
      ],
      settings: {
        gateway: {
          mode: "local",
          timeoutMs: 10_000
        },
        onboarding: {
          providerSetupCompleted: false
        }
      }
    };

    await writeFile(stateFilePath, `${JSON.stringify(existingState, null, 2)}\n`, "utf-8");

    const store = new WorkbenchStore({
      stateFilePath,
      nowIso: () => "2026-02-08T00:00:00.000Z"
    });

    const projects = await store.listProjects();
    expect(projects.some((project) => project.name === "Home")).toBe(true);
    expect(projects.some((project) => project.id === "project-1")).toBe(true);

    const persisted = JSON.parse(await readFile(stateFilePath, "utf-8")) as WorkbenchState;
    expect(persisted.projects.some((project) => project.name === "Home")).toBe(false);
  });
});

