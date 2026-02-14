import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveOpenGoatCommand } from "./command.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("openclaw plugin command resolution", () => {
  it("returns a custom configured command without probing", () => {
    const command = resolveOpenGoatCommand({
      configuredCommand: "custom-opengoat",
      invocationCwd: "/tmp/does-not-matter",
    });

    expect(command).toBe("custom-opengoat");
  });

  it("prefers a local ./bin/opengoat shim when using default command", () => {
    const cwd = mkdtempSync(join(tmpdir(), "opengoat-plugin-cwd-"));
    tempDirs.push(cwd);
    const binDir = join(cwd, "bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "opengoat"), "#!/usr/bin/env node\n", "utf8");

    const command = resolveOpenGoatCommand({
      configuredCommand: "opengoat",
      invocationCwd: cwd,
    });

    expect(command).toBe(join(cwd, "bin/opengoat"));
  });

  it("uses plugin-source repo relative bin path when cwd does not contain a shim", () => {
    const root = mkdtempSync(join(tmpdir(), "opengoat-plugin-root-"));
    tempDirs.push(root);

    const packageDir = join(root, "packages/openclaw-plugin");
    mkdirSync(packageDir, { recursive: true });
    const pluginSource = join(packageDir, "index.ts");
    writeFileSync(pluginSource, "", "utf8");

    const binDir = join(root, "bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "opengoat"), "#!/usr/bin/env node\n", "utf8");

    const command = resolveOpenGoatCommand({
      configuredCommand: "opengoat",
      invocationCwd: join(root, "some-other-dir"),
      pluginSource,
    });

    expect(command).toBe(join(root, "bin/opengoat"));
  });

  it("falls back to PATH command when no shim is found", () => {
    const cwd = mkdtempSync(join(tmpdir(), "opengoat-plugin-empty-"));
    tempDirs.push(cwd);

    const command = resolveOpenGoatCommand({
      configuredCommand: "opengoat",
      invocationCwd: cwd,
    });

    expect(command).toBe("opengoat");
  });
});
