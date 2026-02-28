import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import { NodeFileSystem } from "../../../platform/node/node-file-system.js";
import { NodePathPort } from "../../../platform/node/node-path.port.js";
import { SessionService } from "./session.service.js";

describe("SessionService", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  it("anchors sessions to the agent workspace and reuses session ids for the same session key", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opengoat-session-path-"));
    tempDirs.push(root);

    const service = new SessionService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowMs: createNowMs()
    });
    const paths = createPaths(root);

    const first = await service.prepareRunSession(paths, "goat", {
      sessionRef: "workspace:saaslib",
      userMessage: "first turn"
    });
    expect(first.enabled).toBe(true);
    if (!first.enabled) {
      return;
    }

    const second = await service.prepareRunSession(paths, "goat", {
      sessionRef: "workspace:saaslib",
      userMessage: "second turn"
    });
    expect(second.enabled).toBe(true);
    if (!second.enabled) {
      return;
    }

    expect(second.info.workspacePath).toBe(path.join(root, "workspaces", "goat"));
    expect(second.info.sessionId).toBe(first.info.sessionId);
  });

  it("rotates the session id when forceNew is requested", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opengoat-session-rotate-"));
    tempDirs.push(root);

    const service = new SessionService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowMs: createNowMs()
    });
    const paths = createPaths(root);

    const first = await service.prepareRunSession(paths, "goat", {
      sessionRef: "workspace:shared",
      userMessage: "first turn"
    });
    expect(first.enabled).toBe(true);
    if (!first.enabled) {
      return;
    }

    const second = await service.prepareRunSession(paths, "goat", {
      sessionRef: "workspace:shared",
      forceNew: true,
      userMessage: "second turn"
    });
    expect(second.enabled).toBe(true);
    if (!second.enabled) {
      return;
    }

    expect(second.info.sessionId).not.toBe(first.info.sessionId);
  });

  it("auto-renames placeholder session titles from the first user message", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opengoat-session-auto-title-"));
    tempDirs.push(root);

    const service = new SessionService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowMs: createNowMs()
    });
    const paths = createPaths(root);
    const sessionRef = "workspace:autotitle";

    await service.prepareRunSession(paths, "goat", {
      sessionRef,
      userMessage: ""
    });

    await service.renameSession(paths, "goat", "New Session", sessionRef);

    await service.prepareRunSession(paths, "goat", {
      sessionRef,
      userMessage: "Plan the migration and document each step."
    });

    const sessions = await service.listSessions(paths, "goat");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.title).toBe("Plan the migration a...");
  });

  it("does not auto-rename placeholder titles after the first user message", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opengoat-session-no-retitle-"));
    tempDirs.push(root);

    const service = new SessionService({
      fileSystem: new NodeFileSystem(),
      pathPort: new NodePathPort(),
      nowMs: createNowMs()
    });
    const paths = createPaths(root);
    const sessionRef = "workspace:no-retitle";

    await service.prepareRunSession(paths, "goat", {
      sessionRef,
      userMessage: "Initial kickoff"
    });

    await service.renameSession(paths, "goat", "New Session", sessionRef);

    await service.prepareRunSession(paths, "goat", {
      sessionRef,
      userMessage: "This should not overwrite a post-first-message manual title."
    });

    const sessions = await service.listSessions(paths, "goat");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.title).toBe("New Session");
  });
});

function createNowMs(): () => number {
  let now = 1_700_000_000_000;
  return () => {
    now += 1;
    return now;
  };
}

function createPaths(root: string): OpenGoatPaths {
  return {
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
    agentsIndexJsonPath: path.join(root, "agents.json")
  };
}
