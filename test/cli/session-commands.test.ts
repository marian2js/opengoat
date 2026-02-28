import { describe, expect, it, vi } from "vitest";
import { sessionCommand } from "../../packages/cli/src/cli/commands/session.command.js";
import { sessionCompactCommand } from "../../packages/cli/src/cli/commands/session-compact.command.js";
import { sessionHistoryCommand } from "../../packages/cli/src/cli/commands/session-history.command.js";
import { sessionListCommand } from "../../packages/cli/src/cli/commands/session-list.command.js";
import { sessionRemoveCommand } from "../../packages/cli/src/cli/commands/session-remove.command.js";
import { sessionRenameCommand } from "../../packages/cli/src/cli/commands/session-rename.command.js";
import { sessionResetCommand } from "../../packages/cli/src/cli/commands/session-reset.command.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

function createContext(service: unknown) {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  return {
    context: {
      service: service as never,
      stdout: stdout.stream,
      stderr: stderr.stream
    },
    stdout,
    stderr
  };
}

describe("session CLI commands", () => {
  it("session command prints help", async () => {
    const { context, stdout } = createContext({});
    const code = await sessionCommand.run(["--help"], context);
    expect(code).toBe(0);
    expect(stdout.output()).toContain("opengoat session <command>");
  });

  it("session list validates arguments and prints rows", async () => {
    const listSessions = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          sessionKey: "agent:goat:main",
          sessionId: "abc",
          title: "Main",
          updatedAt: Date.parse("2026-02-07T00:00:00.000Z"),
          transcriptPath: "/tmp/abc.jsonl",
          inputChars: 10,
          outputChars: 20,
          totalChars: 30,
          compactionCount: 1
        }
      ]);

    const invalid = createContext({ listSessions });
    const invalidCode = await sessionListCommand.run(["--active-minutes", "0"], invalid.context);
    expect(invalidCode).toBe(1);
    expect(invalid.stderr.output()).toContain("positive integer");

    const first = createContext({ listSessions });
    const firstCode = await sessionListCommand.run([], first.context);
    expect(firstCode).toBe(0);
    expect(first.stdout.output()).toContain("No sessions found");

    const second = createContext({ listSessions });
    const secondCode = await sessionListCommand.run(["--active-minutes", "10"], second.context);
    expect(secondCode).toBe(0);
    expect(second.stdout.output()).toContain("agent:goat:main");
  });

  it("session history prints transcript entries", async () => {
    const getSessionHistory = vi.fn(async () => ({
      sessionKey: "agent:goat:main",
      sessionId: "abc",
      transcriptPath: "/tmp/abc.jsonl",
      messages: [
        {
          type: "message",
          role: "user",
          content: "hello",
          timestamp: Date.parse("2026-02-07T00:00:00.000Z")
        },
        {
          type: "compaction",
          content: "summary",
          timestamp: Date.parse("2026-02-07T00:01:00.000Z")
        }
      ]
    }));

    const { context, stdout } = createContext({ getSessionHistory });
    const code = await sessionHistoryCommand.run(["--include-compaction"], context);
    expect(code).toBe(0);
    expect(stdout.output()).toContain("[USER]");
    expect(stdout.output()).toContain("[COMPACTION]");
  });

  it("session reset and compact call service", async () => {
    const resetSession = vi.fn(async () => ({
      agentId: "goat",
      sessionKey: "agent:goat:main",
      sessionId: "new-id",
      transcriptPath: "/tmp/new-id.jsonl",
      isNewSession: true
    }));
    const compactSession = vi.fn(async () => ({
      sessionKey: "agent:goat:main",
      sessionId: "new-id",
      transcriptPath: "/tmp/new-id.jsonl",
      applied: true,
      compactedMessages: 5,
      summary: "summary"
    }));

    const resetCtx = createContext({ resetSession });
    const resetCode = await sessionResetCommand.run([], resetCtx.context);
    expect(resetCode).toBe(0);
    expect(resetSession).toHaveBeenCalledWith("goat", undefined);
    expect(resetCtx.stdout.output()).toContain("Reset session");

    const compactCtx = createContext({ compactSession });
    const compactCode = await sessionCompactCommand.run([], compactCtx.context);
    expect(compactCode).toBe(0);
    expect(compactSession).toHaveBeenCalledWith("goat", undefined);
    expect(compactCtx.stdout.output()).toContain("Compaction applied: true");
  });

  it("session rename validates args and calls service", async () => {
    const renameSession = vi.fn(async () => ({
      sessionKey: "agent:goat:main",
      sessionId: "abc",
      title: "Roadmap Work",
      updatedAt: Date.parse("2026-02-07T00:00:00.000Z"),
      transcriptPath: "/tmp/abc.jsonl",
      workspacePath: "/tmp/workspaces/goat",
      inputChars: 0,
      outputChars: 0,
      totalChars: 0,
      compactionCount: 0
    }));

    const invalid = createContext({ renameSession });
    const invalidCode = await sessionRenameCommand.run([], invalid.context);
    expect(invalidCode).toBe(1);
    expect(invalid.stderr.output()).toContain("Missing required option: --title");

    const valid = createContext({ renameSession });
    const validCode = await sessionRenameCommand.run(["--title", "Roadmap Work"], valid.context);
    expect(validCode).toBe(0);
    expect(renameSession).toHaveBeenCalledWith("goat", "Roadmap Work", undefined);
    expect(valid.stdout.output()).toContain("Renamed session");
  });

  it("session remove calls service", async () => {
    const removeSession = vi.fn(async () => ({
      sessionKey: "agent:goat:main",
      sessionId: "abc",
      title: "Main",
      transcriptPath: "/tmp/abc.jsonl"
    }));

    const { context, stdout } = createContext({ removeSession });
    const code = await sessionRemoveCommand.run([], context);
    expect(code).toBe(0);
    expect(removeSession).toHaveBeenCalledWith("goat", undefined);
    expect(stdout.output()).toContain("Removed session");
  });
});
