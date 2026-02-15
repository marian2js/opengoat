import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { restartCommand } from "../../packages/cli/src/cli/commands/restart.command.js";
import { resolveUiServerStatePath } from "../../packages/cli/src/cli/commands/ui-server.command.shared.js";
import { createStreamCapture } from "../helpers/stream-capture.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];
const originalUiServerEntry = process.env.OPENGOAT_UI_SERVER_ENTRY;
const originalOpenGoatHome = process.env.OPENGOAT_HOME;

afterEach(async () => {
  if (originalUiServerEntry === undefined) {
    delete process.env.OPENGOAT_UI_SERVER_ENTRY;
  } else {
    process.env.OPENGOAT_UI_SERVER_ENTRY = originalUiServerEntry;
  }

  if (originalOpenGoatHome === undefined) {
    delete process.env.OPENGOAT_HOME;
  } else {
    process.env.OPENGOAT_HOME = originalOpenGoatHome;
  }

  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("restart command", () => {
  it("prints help", async () => {
    const stdout = createStreamCapture();
    const stderr = createStreamCapture();

    const code = await restartCommand.run(["--help"], {
      service: {} as never,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(code).toBe(0);
    expect(stdout.output()).toContain("opengoat restart");
    expect(stdout.output()).toContain("Stops any tracked OpenGoat UI server");
    expect(stderr.output()).toBe("");
  });

  it("returns validation error for invalid options", async () => {
    const stdout = createStreamCapture();
    const stderr = createStreamCapture();

    const code = await restartCommand.run(["--port", "0"], {
      service: {} as never,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(code).toBe(1);
    expect(stderr.output()).toContain("Invalid --port");
    expect(stdout.output()).toBe("");
  });

  it("starts the configured ui entrypoint when no running process is tracked", async () => {
    const root = await createTempDir("opengoat-restart-command-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;

    const uiEntrypoint = path.join(root, "ui-entry.mjs");
    await writeFile(
      uiEntrypoint,
      "process.exit(process.env.OPENGOAT_OPENCLAW_REGISTER_TOOLS === '1' ? 0 : 3);\n",
      "utf-8",
    );
    process.env.OPENGOAT_UI_SERVER_ENTRY = uiEntrypoint;

    const stdout = createStreamCapture();
    const stderr = createStreamCapture();
    const code = await restartCommand.run(["--port", "19199", "--host", "0.0.0.0"], {
      service: {} as never,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(code).toBe(0);
    expect(stdout.output()).toContain("http://0.0.0.0:19199");
    expect(stdout.output()).toContain("No running OpenGoat UI found for port 19199");
    expect(stderr.output()).toBe("");
  });

  it("stops a tracked ui process before starting again", async () => {
    const root = await createTempDir("opengoat-restart-command-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;

    const runningEntrypoint = path.join(root, "ui-running.mjs");
    await writeFile(
      runningEntrypoint,
      "process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 200);\n",
      "utf-8",
    );

    const replacementEntrypoint = path.join(root, "ui-replacement.mjs");
    await writeFile(replacementEntrypoint, "process.exit(0);\n", "utf-8");
    process.env.OPENGOAT_UI_SERVER_ENTRY = replacementEntrypoint;

    const trackedProcess = spawn(process.execPath, [runningEntrypoint], {
      stdio: "ignore",
    });
    const trackedPid = trackedProcess.pid;
    if (!trackedPid) {
      throw new Error("Failed to start tracked process for restart test.");
    }

    const statePath = resolveUiServerStatePath(19123);
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(
      statePath,
      `${JSON.stringify(
        {
          pid: trackedPid,
          host: "127.0.0.1",
          port: 19123,
          command: "start",
          startedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );

    const stdout = createStreamCapture();
    const stderr = createStreamCapture();

    try {
      const code = await restartCommand.run([], {
        service: {} as never,
        stdout: stdout.stream,
        stderr: stderr.stream,
      });

      expect(code).toBe(0);
      expect(stdout.output()).toContain("Stopped OpenGoat UI process");
      expect(stderr.output()).toBe("");
      await waitForProcessStop(trackedPid, 3_000);
    } finally {
      if (isProcessAlive(trackedPid)) {
        process.kill(trackedPid, "SIGKILL");
      }
    }
  });
});

async function waitForProcessStop(pid: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isProcessAlive(pid)) {
      return;
    }
    await delay(50);
  }
  throw new Error(`Process ${pid} did not stop within ${timeoutMs}ms.`);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ESRCH"
    ) {
      return false;
    }
    return true;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
