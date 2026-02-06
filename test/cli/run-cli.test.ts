import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/apps/cli/cli.js";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const roots: string[] = [];
const originalHome = process.env.OPENGOAT_HOME;

afterEach(async () => {
  if (originalHome === undefined) {
    delete process.env.OPENGOAT_HOME;
  } else {
    process.env.OPENGOAT_HOME = originalHome;
  }

  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("runCli", () => {
  it("bootstraps through CLI init command", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;

    const code = await runCli(["init"]);

    expect(code).toBe(0);

    const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf-8")) as {
      defaultAgent: string;
    };
    expect(config.defaultAgent).toBe("orchestrator");
  });

  it("returns non-zero for unknown commands", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;

    const code = await runCli(["does-not-exist"]);
    expect(code).toBe(1);
  });

  it("supports agent --help", async () => {
    const root = await createTempDir("opengoat-runcli-");
    roots.push(root);
    process.env.OPENGOAT_HOME = root;

    const code = await runCli(["agent", "--help"]);
    expect(code).toBe(0);
  });
});
