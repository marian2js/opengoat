import { writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startCommand } from "../../packages/cli/src/cli/commands/start.command.js";
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

describe("start command", () => {
  it("prints help", async () => {
    const stdout = createStreamCapture();
    const stderr = createStreamCapture();

    const code = await startCommand.run(["--help"], {
      service: {} as never,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(code).toBe(0);
    expect(stdout.output()).toContain("opengoat start");
    expect(stdout.output()).toContain("production mode");
    expect(stderr.output()).toBe("");
  });

  it("returns validation error for invalid options", async () => {
    const stdout = createStreamCapture();
    const stderr = createStreamCapture();

    const code = await startCommand.run(["--port", "0"], {
      service: {} as never,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(code).toBe(1);
    expect(stderr.output()).toContain("Invalid --port");
    expect(stdout.output()).toBe("");
  });

  it("starts the configured ui entrypoint", async () => {
    const root = await createTempDir("opengoat-start-command-");
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
    const code = await startCommand.run(["--port", "19199", "--host", "0.0.0.0"], {
      service: {} as never,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(code).toBe(0);
    expect(stdout.output()).toContain("http://0.0.0.0:19199");
    expect(stderr.output()).toBe("");
  });
});
