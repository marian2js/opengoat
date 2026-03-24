import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MessagingConnectionService } from "../packages/core/src/core/messaging-connections/application/messaging-connection.service.js";
import { MessagingRouterService } from "../packages/core/src/core/messaging-router/application/messaging-router.service.js";
import type { OpenGoatPaths } from "../packages/core/src/core/domain/opengoat-paths.js";
import { NodeFileSystem } from "../packages/core/src/platform/node/node-file-system.js";
import { NodePathPort } from "../packages/core/src/platform/node/node-path.port.js";

function createTestPaths(root: string): OpenGoatPaths {
  return {
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
}

const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  }
});

function createServices() {
  const fileSystem = new NodeFileSystem();
  const pathPort = new NodePathPort();
  const nowIso = () => "2026-03-24T12:00:00.000Z";

  const connectionService = new MessagingConnectionService({ fileSystem, pathPort, nowIso });
  const routerService = new MessagingRouterService({ fileSystem, pathPort, nowIso, connectionService });

  return { connectionService, routerService };
}

describe("MessagingRouterService", () => {
  it("resolves a new thread and creates a thread link", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-router-"));
    roots.push(root);
    const paths = createTestPaths(root);
    const { connectionService, routerService } = createServices();

    const connection = await connectionService.create(paths, {
      workspaceId: "ws-1",
      type: "telegram",
      displayName: "TG Bot",
      defaultProjectId: "proj-1",
    });

    const result = await routerService.resolveThread(
      paths,
      connection.connectionId,
      "tg:chat:12345",
    );

    expect(result.projectId).toBe("proj-1");
    expect(result.chatThreadId).toBeTruthy();
    expect(result.isNew).toBe(true);
  });

  it("returns existing thread link on second resolve", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-router-"));
    roots.push(root);
    const paths = createTestPaths(root);
    const { connectionService, routerService } = createServices();

    const connection = await connectionService.create(paths, {
      workspaceId: "ws-1",
      type: "whatsapp",
      displayName: "WA",
      defaultProjectId: "proj-1",
    });

    const first = await routerService.resolveThread(
      paths,
      connection.connectionId,
      "wa:jid:999",
    );
    const second = await routerService.resolveThread(
      paths,
      connection.connectionId,
      "wa:jid:999",
    );

    expect(second.isNew).toBe(false);
    expect(second.chatThreadId).toBe(first.chatThreadId);
    expect(second.projectId).toBe(first.projectId);
  });

  it("creates separate thread links for different external threads", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-router-"));
    roots.push(root);
    const paths = createTestPaths(root);
    const { connectionService, routerService } = createServices();

    const connection = await connectionService.create(paths, {
      workspaceId: "ws-1",
      type: "telegram",
      displayName: "TG",
      defaultProjectId: "proj-1",
    });

    const thread1 = await routerService.resolveThread(
      paths,
      connection.connectionId,
      "tg:chat:111",
    );
    const thread2 = await routerService.resolveThread(
      paths,
      connection.connectionId,
      "tg:chat:222",
    );

    expect(thread1.chatThreadId).not.toBe(thread2.chatThreadId);
    expect(thread1.isNew).toBe(true);
    expect(thread2.isNew).toBe(true);
  });

  it("updates lastSeenAt on a thread link", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-router-"));
    roots.push(root);
    const paths = createTestPaths(root);
    const { connectionService, routerService } = createServices();

    const connection = await connectionService.create(paths, {
      workspaceId: "ws-1",
      type: "telegram",
      displayName: "TG",
      defaultProjectId: "proj-1",
    });

    const result = await routerService.resolveThread(
      paths,
      connection.connectionId,
      "tg:chat:555",
    );

    // updateLastSeen should not throw
    await routerService.updateLastSeen(paths, result.chatThreadId);
  });
});
