import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it } from "vitest";
import { runOpenGoatProcess, type SpawnProcess } from "./process-runner.js";

describe("openclaw plugin process runner", () => {
  it("returns the process exit code", async () => {
    const result = await runOpenGoatProcess({
      command: process.execPath,
      args: ["-e", "process.exit(7)"],
    });

    expect(result).toEqual({ exitCode: 7, signal: null });
  });

  it("wraps ENOENT spawn failures with a useful error", async () => {
    const spawnProcess: SpawnProcess = () => {
      const child = new EventEmitter() as ChildProcess;
      queueMicrotask(() => {
        const error = Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" });
        child.emit("error", error);
      });
      return child;
    };

    await expect(
      runOpenGoatProcess(
        {
          command: "missing-opengoat",
          args: [],
        },
        spawnProcess,
      ),
    ).rejects.toThrow("OpenGoat command not found: missing-opengoat");
  });
});
