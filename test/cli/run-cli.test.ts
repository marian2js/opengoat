import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../packages/cli/src/cli/cli.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];
const originalHome = process.env.OPENGOAT_HOME;
const originalOpenClawStateDir = process.env.OPENCLAW_STATE_DIR;
const originalOpenClawConfigPath = process.env.OPENCLAW_CONFIG_PATH;
const BOOTSTRAP_TIMEOUT_MS = 90_000;
const INIT_TIMEOUT_MS = 45_000;
const HARD_RESET_TIMEOUT_MS = 45_000;

afterEach(async () => {
  if (originalHome === undefined) {
    delete process.env.OPENGOAT_HOME;
  } else {
    process.env.OPENGOAT_HOME = originalHome;
  }
  if (originalOpenClawStateDir === undefined) {
    delete process.env.OPENCLAW_STATE_DIR;
  } else {
    process.env.OPENCLAW_STATE_DIR = originalOpenClawStateDir;
  }
  if (originalOpenClawConfigPath === undefined) {
    delete process.env.OPENCLAW_CONFIG_PATH;
  } else {
    process.env.OPENCLAW_CONFIG_PATH = originalOpenClawConfigPath;
  }

  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("runCli", () => {
  it("shows help and does not bootstrap when no args are provided", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const code = await runCli([]);

    expect(code).toBe(0);
    await expect(
      access(path.join(root, "config.json"), constants.F_OK),
    ).rejects.toBeTruthy();
  });

  it("prints version and does not bootstrap when --version is provided", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const expectedVersion = await readCliPackageVersion();
    const writes: string[] = [];
    const writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(((chunk: string | Uint8Array) => {
        writes.push(typeof chunk === "string" ? chunk : chunk.toString("utf-8"));
        return true;
      }) as typeof process.stdout.write);

    try {
      const code = await runCli(["--version"]);
      expect(code).toBe(0);
    } finally {
      writeSpy.mockRestore();
    }

    expect(writes.join("")).toContain(`${expectedVersion}\n`);
    await expect(
      access(path.join(root, "config.json"), constants.F_OK),
    ).rejects.toBeTruthy();
  });

  it("bootstraps through CLI onboard command on a fresh home", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const code = await runCli(["onboard", "--non-interactive", "--local"]);

    expect(code).toBe(0);

    const config = JSON.parse(
      await readFile(path.join(root, "config.json"), "utf-8"),
    ) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("ceo");
  }, BOOTSTRAP_TIMEOUT_MS);

  it("bootstraps through CLI init command", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const code = await runCli(["init"]);

    expect(code).toBe(0);

    const config = JSON.parse(
      await readFile(path.join(root, "config.json"), "utf-8"),
    ) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("ceo");
  }, INIT_TIMEOUT_MS);

  it("returns non-zero for unknown commands", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const code = await runCli(["does-not-exist"]);
    expect(code).toBe(1);
  });

  it("supports agent --help", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const code = await runCli(["agent", "--help"]);
    expect(code).toBe(0);
  });

  it("supports acp --help", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const code = await runCli(["acp", "--help"]);
    expect(code).toBe(0);
  });

  it("supports start --help", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const code = await runCli(["start", "--help"]);
    expect(code).toBe(0);
  });

  it("supports restart --help", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const code = await runCli(["restart", "--help"]);
    expect(code).toBe(0);
  });

  it("supports global log flags before command", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const code = await runCli([
      "--log-level",
      "debug",
      "--log-format",
      "json",
      "init",
    ]);
    expect(code).toBe(0);
  });

  it("supports global log flags after command options", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const code = await runCli([
      "agent",
      "--help",
      "--log-level",
      "debug",
      "--log-format",
      "pretty",
    ]);
    expect(code).toBe(0);
  });

  it("supports hard-reset --yes and removes OpenGoat home", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;
    applyOpenClawIsolation(root);

    const initCode = await runCli(["init"]);
    expect(initCode).toBe(0);
    await expect(
      access(path.join(root, "config.json"), constants.F_OK),
    ).resolves.toBeUndefined();

    const resetCode = await runCli(["hard-reset", "--yes"]);
    expect([0, 1]).toContain(resetCode);
    await expect(
      access(path.join(root, "config.json"), constants.F_OK),
    ).rejects.toBeTruthy();
  }, HARD_RESET_TIMEOUT_MS);
});

function applyOpenClawIsolation(root: string): void {
  const stateDir = path.join(root, ".openclaw");
  process.env.OPENCLAW_STATE_DIR = stateDir;
  process.env.OPENCLAW_CONFIG_PATH = path.join(stateDir, "openclaw.json");
}

async function readCliPackageVersion(): Promise<string> {
  const packageJsonPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "packages",
    "cli",
    "package.json",
  );
  const parsed = JSON.parse(await readFile(packageJsonPath, "utf-8")) as {
    version: string;
  };
  return parsed.version;
}
