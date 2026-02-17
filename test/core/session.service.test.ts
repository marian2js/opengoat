import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenGoatPaths } from "../../packages/core/src/core/domain/opengoat-paths.js";
import type { CommandRunnerPort } from "../../packages/core/src/core/ports/command-runner.port.js";
import { SessionService } from "../../packages/core/src/core/sessions/index.js";
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

describe("SessionService", () => {
  it("creates a session and appends transcript messages", async () => {
    const root = await createTempDir("opengoat-session-");
    roots.push(root);

    const { fileSystem, paths } = await createPaths(root);
    await seedAgentConfig(fileSystem, paths, "ceo", {});

    const now = { value: Date.parse("2026-02-07T00:00:00.000Z") };
    const service = createService(now);

    const first = await service.prepareRunSession(paths, "ceo", {
      userMessage: "hello from user"
    });
    expect(first.enabled).toBe(true);
    if (!first.enabled) {
      throw new Error("Expected session-enabled run.");
    }

    expect(first.info.isNewSession).toBe(true);
    expect(first.info.sessionKey).toBe("agent:ceo:main");

    await service.recordAssistantReply(paths, first.info, "hello from assistant");

    now.value += 1_000;
    const second = await service.prepareRunSession(paths, "ceo", {
      userMessage: "follow-up request"
    });
    expect(second.enabled).toBe(true);
    if (!second.enabled) {
      throw new Error("Expected session-enabled run.");
    }
    expect(second.info.isNewSession).toBe(false);

    const history = await service.getSessionHistory(paths, "ceo", {
      includeCompaction: true
    });
    expect(history.sessionKey).toBe("agent:ceo:main");
    expect(history.messages.filter((message) => message.type === "message")).toHaveLength(3);
  });

  it("creates a new session id after idle reset expires", async () => {
    const root = await createTempDir("opengoat-session-");
    roots.push(root);

    const { fileSystem, paths } = await createPaths(root);
    await seedAgentConfig(fileSystem, paths, "ceo", {
      reset: { mode: "idle", idleMinutes: 1, atHour: 4 }
    });

    const now = { value: Date.parse("2026-02-07T00:00:00.000Z") };
    const service = createService(now);

    const first = await service.prepareRunSession(paths, "ceo", {
      userMessage: "first"
    });
    expect(first.enabled).toBe(true);
    if (!first.enabled) {
      throw new Error("Expected session-enabled run.");
    }

    const firstSessionId = first.info.sessionId;
    now.value += 61_000;

    const second = await service.prepareRunSession(paths, "ceo", {
      userMessage: "after idle window"
    });
    expect(second.enabled).toBe(true);
    if (!second.enabled) {
      throw new Error("Expected session-enabled run.");
    }

    expect(second.info.isNewSession).toBe(true);
    expect(second.info.sessionId).not.toBe(firstSessionId);
  });

  it("returns the latest assistant action timestamp for an agent", async () => {
    const root = await createTempDir("opengoat-session-");
    roots.push(root);

    const { fileSystem, paths } = await createPaths(root);
    await seedAgentConfig(fileSystem, paths, "ceo", {});

    const now = { value: Date.parse("2026-02-07T00:00:00.000Z") };
    const service = createService(now);

    const first = await service.prepareRunSession(paths, "ceo", {
      sessionRef: "alpha",
      userMessage: "first"
    });
    if (!first.enabled) {
      throw new Error("Expected session-enabled run.");
    }
    await service.recordAssistantReply(paths, first.info, "assistant-first");

    now.value += 1_000;
    const second = await service.prepareRunSession(paths, "ceo", {
      sessionRef: "beta",
      userMessage: "second"
    });
    if (!second.enabled) {
      throw new Error("Expected session-enabled run.");
    }
    await service.recordAssistantReply(paths, second.info, "assistant-second");
    const expectedTimestamp = now.value;

    now.value += 1_000;
    await service.prepareRunSession(paths, "ceo", {
      sessionRef: "gamma",
      userMessage: "user-only"
    });

    const lastAction = await service.getLastAgentAction(paths, "ceo");
    expect(lastAction).not.toBeNull();
    expect(lastAction?.agentId).toBe("ceo");
    expect(lastAction?.sessionId).toBe(second.info.sessionId);
    expect(lastAction?.timestamp).toBe(expectedTimestamp);
  });

  it("keeps session continuity for the same session key and only rotates on forceNew", async () => {
    const root = await createTempDir("opengoat-session-");
    roots.push(root);

    const { fileSystem, paths } = await createPaths(root);
    await seedAgentConfig(fileSystem, paths, "ceo", {});

    const now = { value: Date.parse("2026-02-07T00:00:00.000Z") };
    const service = createService(now);

    const first = await service.prepareRunSession(paths, "ceo", {
      userMessage: "first"
    });
    expect(first.enabled).toBe(true);
    if (!first.enabled) {
      throw new Error("Expected session-enabled run.");
    }
    const firstSessionId = first.info.sessionId;
    expect(first.info.workspacePath).toBe(path.join(paths.workspacesDir, "ceo"));

    now.value += 1_000;
    const second = await service.prepareRunSession(paths, "ceo", {
      userMessage: "second"
    });
    expect(second.enabled).toBe(true);
    if (!second.enabled) {
      throw new Error("Expected session-enabled run.");
    }
    expect(second.info.sessionId).toBe(firstSessionId);

    now.value += 1_000;
    const third = await service.prepareRunSession(paths, "ceo", {
      forceNew: true,
      userMessage: "third"
    });
    expect(third.enabled).toBe(true);
    if (!third.enabled) {
      throw new Error("Expected session-enabled run.");
    }
    expect(third.info.isNewSession).toBe(true);
    expect(third.info.sessionId).not.toBe(firstSessionId);
  });

  it("compacts transcript history and keeps recent messages", async () => {
    const root = await createTempDir("opengoat-session-");
    roots.push(root);

    const { fileSystem, paths } = await createPaths(root);
    await seedAgentConfig(fileSystem, paths, "ceo", {
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
      const prepared = await service.prepareRunSession(paths, "ceo", {
        userMessage: `user message ${turn}`
      });
      if (!prepared.enabled) {
        throw new Error("Expected session-enabled run.");
      }
      await service.recordAssistantReply(paths, prepared.info, `assistant message ${turn}`);
      now.value += 1_000;
    }

    const compacted = await service.compactSession(paths, "ceo");
    expect(compacted.applied).toBe(true);
    expect(compacted.compactedMessages).toBeGreaterThan(0);
    expect(compacted.summary).toContain("Compaction summary");

    const history = await service.getSessionHistory(paths, "ceo", {
      includeCompaction: true
    });
    expect(history.messages.some((message) => message.type === "compaction")).toBe(true);
    expect(history.messages.filter((message) => message.type === "message")).toHaveLength(2);

    const sessions = await service.listSessions(paths, "ceo");
    expect(sessions[0]?.compactionCount).toBeGreaterThan(0);
  });

  it("renames and removes a session", async () => {
    const root = await createTempDir("opengoat-session-");
    roots.push(root);

    const { fileSystem, paths } = await createPaths(root);
    await seedAgentConfig(fileSystem, paths, "ceo", {});

    const now = { value: Date.parse("2026-02-07T00:00:00.000Z") };
    const service = createService(now);

    const prepared = await service.prepareRunSession(paths, "ceo", {
      userMessage: "hello"
    });
    if (!prepared.enabled) {
      throw new Error("Expected session-enabled run.");
    }

    const renamed = await service.renameSession(paths, "ceo", "Roadmap Draft");
    expect(renamed.title).toBe("Roadmap Draft");

    const listed = await service.listSessions(paths, "ceo");
    expect(listed[0]?.title).toBe("Roadmap Draft");

    const removed = await service.removeSession(paths, "ceo");
    expect(removed.title).toBe("Roadmap Draft");

    const remaining = await service.listSessions(paths, "ceo");
    expect(remaining).toHaveLength(0);
  });

  it("does not run git commands during session setup", async () => {
    const root = await createTempDir("opengoat-session-");
    roots.push(root);

    const { fileSystem, paths } = await createPaths(root);
    await seedAgentConfig(fileSystem, paths, "ceo", {});
    const commandCalls: Array<{ command: string; args: string[]; cwd?: string }> = [];
    const commandRunner: CommandRunnerPort = {
      async run(request) {
        commandCalls.push({
          command: request.command,
          args: request.args,
          cwd: request.cwd
        });
        return { code: 0, stdout: "", stderr: "" };
      }
    };

    const now = { value: Date.parse("2026-02-07T00:00:00.000Z") };
    const service = createService(now, commandRunner);

    const prepared = await service.prepareRunSession(paths, "ceo", {
      userMessage: "hello"
    });
    expect(prepared.enabled).toBe(true);
    expect(commandCalls).toHaveLength(0);
  });
});

function createService(now: { value: number }, commandRunner?: CommandRunnerPort): SessionService {
  return new SessionService({
    fileSystem: new NodeFileSystem(),
    pathPort: new NodePathPort(),
    commandRunner,
    nowIso: () => new Date(now.value).toISOString(),
    nowMs: () => now.value
  });
}

async function createPaths(root: string): Promise<{ paths: OpenGoatPaths; fileSystem: NodeFileSystem }> {
  const fileSystem = new NodeFileSystem();
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
    agentsIndexJsonPath: path.join(root, "agents.json")
  };

  await fileSystem.ensureDir(paths.homeDir);
  await fileSystem.ensureDir(paths.workspacesDir);
  await fileSystem.ensureDir(paths.agentsDir);
  await fileSystem.ensureDir(paths.providersDir);
  await fileSystem.ensureDir(paths.sessionsDir);
  await fileSystem.ensureDir(paths.runsDir);
  await fileSystem.ensureDir(path.join(paths.agentsDir, "ceo"));

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
        displayName: "CEO",
        provider: { id: "openclaw" },
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
