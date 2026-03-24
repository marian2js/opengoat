import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MessagingConnectionService } from "../packages/core/src/core/messaging-connections/application/messaging-connection.service.js";
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

function createService() {
  return new MessagingConnectionService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    nowIso: () => "2026-03-24T12:00:00.000Z",
  });
}

describe("MessagingConnectionService", () => {
  it("creates a messaging connection and returns a record", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-conn-"));
    roots.push(root);
    const paths = createTestPaths(root);
    const service = createService();

    const connection = await service.create(paths, {
      workspaceId: "ws-1",
      type: "telegram",
      displayName: "My Telegram Bot",
      defaultProjectId: "proj-1",
    });

    expect(connection.connectionId).toBeTruthy();
    expect(connection.workspaceId).toBe("ws-1");
    expect(connection.type).toBe("telegram");
    expect(connection.status).toBe("pending");
    expect(connection.displayName).toBe("My Telegram Bot");
    expect(connection.defaultProjectId).toBe("proj-1");
    expect(connection.createdAt).toBe("2026-03-24T12:00:00.000Z");
    expect(connection.updatedAt).toBe("2026-03-24T12:00:00.000Z");
  });

  it("lists connections for a workspace", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-conn-"));
    roots.push(root);
    const paths = createTestPaths(root);
    const service = createService();

    await service.create(paths, {
      workspaceId: "ws-1",
      type: "telegram",
      displayName: "Telegram Bot",
      defaultProjectId: "proj-1",
    });
    await service.create(paths, {
      workspaceId: "ws-1",
      type: "whatsapp",
      displayName: "WhatsApp",
      defaultProjectId: "proj-1",
    });
    await service.create(paths, {
      workspaceId: "ws-2",
      type: "telegram",
      displayName: "Other WS",
      defaultProjectId: "proj-2",
    });

    const ws1Connections = await service.list(paths, "ws-1");
    expect(ws1Connections).toHaveLength(2);
    expect(ws1Connections.map((c) => c.type).sort()).toEqual(["telegram", "whatsapp"]);

    const ws2Connections = await service.list(paths, "ws-2");
    expect(ws2Connections).toHaveLength(1);
    expect(ws2Connections[0]!.type).toBe("telegram");
  });

  it("gets a connection by id", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-conn-"));
    roots.push(root);
    const paths = createTestPaths(root);
    const service = createService();

    const created = await service.create(paths, {
      workspaceId: "ws-1",
      type: "whatsapp",
      displayName: "WA Bot",
      defaultProjectId: "proj-1",
    });

    const fetched = await service.get(paths, created.connectionId);
    expect(fetched).toBeDefined();
    expect(fetched!.connectionId).toBe(created.connectionId);
    expect(fetched!.displayName).toBe("WA Bot");
  });

  it("returns undefined for non-existent connection", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-conn-"));
    roots.push(root);
    const paths = createTestPaths(root);
    const service = createService();

    const fetched = await service.get(paths, "non-existent");
    expect(fetched).toBeUndefined();
  });

  it("updates connection status", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-conn-"));
    roots.push(root);
    const paths = createTestPaths(root);
    const service = createService();

    const created = await service.create(paths, {
      workspaceId: "ws-1",
      type: "telegram",
      displayName: "TG Bot",
      defaultProjectId: "proj-1",
    });

    const updated = await service.updateStatus(
      paths,
      created.connectionId,
      "connected",
      "bot-token-ref",
    );

    expect(updated.status).toBe("connected");
    expect(updated.configRef).toBe("bot-token-ref");
  });

  it("deletes a connection", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-conn-"));
    roots.push(root);
    const paths = createTestPaths(root);
    const service = createService();

    const created = await service.create(paths, {
      workspaceId: "ws-1",
      type: "telegram",
      displayName: "TG Bot",
      defaultProjectId: "proj-1",
    });

    await service.delete(paths, created.connectionId);

    const fetched = await service.get(paths, created.connectionId);
    expect(fetched).toBeUndefined();
  });

  it("persists connections across service instances", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "msg-conn-"));
    roots.push(root);
    const paths = createTestPaths(root);

    const service1 = createService();
    await service1.create(paths, {
      workspaceId: "ws-1",
      type: "telegram",
      displayName: "Persistent Bot",
      defaultProjectId: "proj-1",
    });

    const service2 = createService();
    const connections = await service2.list(paths, "ws-1");
    expect(connections).toHaveLength(1);
    expect(connections[0]!.displayName).toBe("Persistent Bot");
  });
});
