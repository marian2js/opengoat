import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../src/core/domain/opengoat-paths.js";
import { SessionService } from "../../src/core/sessions/index.js";
import { NodeFileSystem } from "../../src/platform/node/node-file-system.js";
import { NodePathPort } from "../../src/platform/node/node-path.port.js";
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

describe("SessionService", () => {
  it("creates a session, appends transcript messages, and injects prior history", async () => {
    const root = await createTempDir("opengoat-session-");
    roots.push(root);

    const { fileSystem, paths } = await createPaths(root);
    await seedAgentConfig(fileSystem, paths, "orchestrator", {});

    const now = { value: Date.parse("2026-02-07T00:00:00.000Z") };
    const service = createService(now);

    const first = await service.prepareRunSession(paths, "orchestrator", {
      userMessage: "hello from user"
    });
    expect(first.enabled).toBe(true);
    if (!first.enabled) {
      throw new Error("Expected session-enabled run.");
    }

    expect(first.info.isNewSession).toBe(true);
    expect(first.info.sessionKey).toBe("agent:orchestrator:main");
    expect(first.contextPrompt).toBe("");

    await service.recordAssistantReply(paths, first.info, "hello from assistant");

    now.value += 1_000;
    const second = await service.prepareRunSession(paths, "orchestrator", {
      userMessage: "follow-up request"
    });
    expect(second.enabled).toBe(true);
    if (!second.enabled) {
      throw new Error("Expected session-enabled run.");
    }
    expect(second.info.isNewSession).toBe(false);
    expect(second.contextPrompt).toContain("hello from user");
    expect(second.contextPrompt).toContain("hello from assistant");

    const history = await service.getSessionHistory(paths, "orchestrator", {
      includeCompaction: true
    });
    expect(history.sessionKey).toBe("agent:orchestrator:main");
    expect(history.messages.filter((message) => message.type === "message")).toHaveLength(3);
  });

  it("creates a new session id after idle reset expires", async () => {
    const root = await createTempDir("opengoat-session-");
    roots.push(root);

    const { fileSystem, paths } = await createPaths(root);
    await seedAgentConfig(fileSystem, paths, "orchestrator", {
      reset: { mode: "idle", idleMinutes: 1, atHour: 4 }
    });

    const now = { value: Date.parse("2026-02-07T00:00:00.000Z") };
    const service = createService(now);

    const first = await service.prepareRunSession(paths, "orchestrator", {
      userMessage: "first"
    });
    expect(first.enabled).toBe(true);
    if (!first.enabled) {
      throw new Error("Expected session-enabled run.");
    }

    const firstSessionId = first.info.sessionId;
    now.value += 61_000;

    const second = await service.prepareRunSession(paths, "orchestrator", {
      userMessage: "after idle window"
    });
    expect(second.enabled).toBe(true);
    if (!second.enabled) {
      throw new Error("Expected session-enabled run.");
    }

    expect(second.info.isNewSession).toBe(true);
    expect(second.info.sessionId).not.toBe(firstSessionId);
  });

  it("compacts transcript history and keeps recent messages", async () => {
    const root = await createTempDir("opengoat-session-");
    roots.push(root);

    const { fileSystem, paths } = await createPaths(root);
    await seedAgentConfig(fileSystem, paths, "orchestrator", {
      compaction: {
        enabled: false,
        triggerMessageCount: 999,
        triggerChars: 999_999,
        keepRecentMessages: 2,
        summaryMaxChars: 240
      }
    });

    const now = { value: Date.parse("2026-02-07T00:00:00.000Z") };
    const service = createService(now);

    for (const turn of [1, 2, 3]) {
      const prepared = await service.prepareRunSession(paths, "orchestrator", {
        userMessage: `user message ${turn}`
      });
      if (!prepared.enabled) {
        throw new Error("Expected session-enabled run.");
      }
      await service.recordAssistantReply(paths, prepared.info, `assistant message ${turn}`);
      now.value += 1_000;
    }

    const compacted = await service.compactSession(paths, "orchestrator");
    expect(compacted.applied).toBe(true);
    expect(compacted.compactedMessages).toBeGreaterThan(0);
    expect(compacted.summary).toContain("Compaction summary");

    const history = await service.getSessionHistory(paths, "orchestrator", {
      includeCompaction: true
    });
    expect(history.messages.some((message) => message.type === "compaction")).toBe(true);
    expect(history.messages.filter((message) => message.type === "message")).toHaveLength(2);

    const sessions = await service.listSessions(paths, "orchestrator");
    expect(sessions[0]?.compactionCount).toBeGreaterThan(0);
  });
});

function createService(now: { value: number }): SessionService {
  return new SessionService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    nowIso: () => new Date(now.value).toISOString(),
    nowMs: () => now.value
  });
}

async function createPaths(root: string): Promise<{ paths: OpenGoatPaths; fileSystem: NodeFileSystem }> {
  const fileSystem = new NodeFileSystem();
  const paths: OpenGoatPaths = {
    homeDir: root,
    workspacesDir: path.join(root, "workspaces"),
    agentsDir: path.join(root, "agents"),
    skillsDir: path.join(root, "skills"),
    providersDir: path.join(root, "providers"),
    runsDir: path.join(root, "runs"),
    globalConfigJsonPath: path.join(root, "config.json"),
    globalConfigMarkdownPath: path.join(root, "CONFIG.md"),
    agentsIndexJsonPath: path.join(root, "agents.json")
  };

  await fileSystem.ensureDir(paths.homeDir);
  await fileSystem.ensureDir(paths.workspacesDir);
  await fileSystem.ensureDir(paths.agentsDir);
  await fileSystem.ensureDir(paths.providersDir);
  await fileSystem.ensureDir(paths.runsDir);
  await fileSystem.ensureDir(path.join(paths.agentsDir, "orchestrator"));

  return { paths, fileSystem };
}

async function seedAgentConfig(
  fileSystem: NodeFileSystem,
  paths: OpenGoatPaths,
  agentId: string,
  sessions: Record<string, unknown>
): Promise<void> {
  const configPath = path.join(paths.agentsDir, agentId, "config.json");
  await fileSystem.writeFile(
    configPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: agentId,
        displayName: "Orchestrator",
        provider: { id: "codex" },
        runtime: {
          sessions: {
            mainKey: "main",
            contextMaxChars: 12_000,
            reset: { mode: "daily", atHour: 4 },
            pruning: { enabled: true, maxMessages: 40, maxChars: 16_000, keepRecentMessages: 12 },
            compaction: {
              enabled: true,
              triggerMessageCount: 80,
              triggerChars: 32_000,
              keepRecentMessages: 20,
              summaryMaxChars: 4_000
            },
            ...sessions
          }
        }
      },
      null,
      2
    )}\n`
  );
}
