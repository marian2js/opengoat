import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("opengoat binary", () => {
  it("shows help and does not bootstrap when no args are provided", async () => {
    const root = await createTempDir("opengoat-bin-");
    roots.push(root);

    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
    const binaryPath = path.join(projectRoot, "bin", "opengoat");

    const { stdout } = await execFileAsync(binaryPath, [], {
      cwd: projectRoot,
      env: {
        ...process.env,
        OPENGOAT_HOME: root,
        ...buildOpenClawIsolatedEnv(root),
      }
    });

    expect(stdout).toContain("OpenGoat CLI");

    await expect(access(path.join(root, "config.json"), constants.F_OK)).rejects.toBeTruthy();
  });

  it("runs onboard on a fresh home and bootstraps config files", async () => {
    const root = await createTempDir("opengoat-bin-");
    roots.push(root);

    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
    const binaryPath = path.join(projectRoot, "bin", "opengoat");

    const { stdout } = await execFileAsync(
      binaryPath,
      ["onboard", "--non-interactive", "--local"],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          OPENGOAT_HOME: root,
          ...buildOpenClawIsolatedEnv(root),
        }
      }
    );

    expect(stdout).toContain("Mode: local");

    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf-8")) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("ceo");
  });

  it("runs init and creates config files", async () => {
    const root = await createTempDir("opengoat-bin-");
    roots.push(root);

    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
    const binaryPath = path.join(projectRoot, "bin", "opengoat");

    const { stdout } = await execFileAsync(binaryPath, ["init"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        OPENGOAT_HOME: root,
        ...buildOpenClawIsolatedEnv(root),
      }
    });

    expect(stdout).toContain("Default agent: ceo");

    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf-8")) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("ceo");
  });
});

function buildOpenClawIsolatedEnv(root: string): NodeJS.ProcessEnv {
  const stateDir = path.join(root, ".openclaw");
  return {
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: path.join(stateDir, "openclaw.json"),
  };
}
