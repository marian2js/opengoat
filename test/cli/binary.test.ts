import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
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
  it("runs onboard on a fresh home and bootstraps config files", async () => {
    const root = await createTempDir("opengoat-bin-");
    roots.push(root);

    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
    const binaryPath = path.join(projectRoot, "bin", "opengoat");

    const { stdout } = await execFileAsync(
      binaryPath,
      ["onboard", "--non-interactive", "--provider", "openai", "--openai-api-key", "sk-test"],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          OPENGOAT_HOME: root
        }
      }
    );

    expect(stdout).toContain("Onboarding complete.");

    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf-8")) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("orchestrator");
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
        OPENGOAT_HOME: root
      }
    });

    expect(stdout).toContain("Default agent: orchestrator");

    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf-8")) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("orchestrator");
  });
});
