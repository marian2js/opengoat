import { describe, expect, it, vi } from "vitest";
import { hardResetCommand } from "../../packages/cli/src/cli/commands/hard-reset.command.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

function createContext(service: unknown) {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  return {
    context: {
      service: service as never,
      stdout: stdout.stream,
      stderr: stderr.stream,
    },
    stdout,
    stderr,
  };
}

describe("hard-reset command", () => {
  it("prints help", async () => {
    const { context, stdout } = createContext({});
    const code = await hardResetCommand.run(["--help"], context);

    expect(code).toBe(0);
    expect(stdout.output()).toContain("Usage:");
    expect(stdout.output()).toContain("opengoat hard-reset");
  });

  it("requires --yes in non-interactive mode", async () => {
    const hardReset = vi.fn();
    const { context, stderr } = createContext({ hardReset });
    const code = await hardResetCommand.run([], context);

    expect(code).toBe(1);
    expect(hardReset).not.toHaveBeenCalled();
    expect(stderr.output()).toContain(
      "Confirmation required in non-interactive mode. Re-run with --yes.",
    );
  });

  it("runs hard reset with --yes", async () => {
    const hardReset = vi.fn(async () => ({
      homeDir: "/tmp/opengoat",
      homeRemoved: true,
      deletedOpenClawAgents: ["goat", "cto"],
      failedOpenClawAgents: [],
      removedOpenClawManagedSkillDirs: ["/tmp/openclaw/skills/og-board-manager"],
      warnings: [],
    }));
    const { context, stdout } = createContext({ hardReset });
    const code = await hardResetCommand.run(["--yes"], context);

    expect(code).toBe(0);
    expect(hardReset).toHaveBeenCalledOnce();
    expect(stdout.output()).toContain("Hard reset completed.");
    expect(stdout.output()).toContain("OpenClaw agents removed: 2");
  });

  it("returns non-zero when OpenClaw agent cleanup fails", async () => {
    const hardReset = vi.fn(async () => ({
      homeDir: "/tmp/opengoat",
      homeRemoved: true,
      deletedOpenClawAgents: ["goat"],
      failedOpenClawAgents: [
        {
          agentId: "cto",
          reason: "delete failed",
        },
      ],
      removedOpenClawManagedSkillDirs: [],
      warnings: [],
    }));
    const { context, stderr } = createContext({ hardReset });
    const code = await hardResetCommand.run(["--yes"], context);

    expect(code).toBe(1);
    expect(stderr.output()).toContain(
      'Failed to remove OpenClaw agent "cto": delete failed',
    );
  });
});
