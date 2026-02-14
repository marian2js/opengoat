import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureOpenGoatCommandOnPath } from "./path-env.js";

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

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeCommandFile(directory: string, commandName = "opengoat"): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, commandName), "#!/usr/bin/env node\n", "utf8");
}

describe("ensureOpenGoatCommandOnPath", () => {
  it("leaves PATH unchanged when command is already present", () => {
    const binDir = createTempDir("opengoat-path-present-");
    writeCommandFile(binDir);

    const env = { PATH: binDir };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = ensureOpenGoatCommandOnPath({
      env,
      logger,
      cwd: createTempDir("opengoat-cwd-"),
      pluginSource: join(createTempDir("opengoat-plugin-"), "index.ts"),
    });

    expect(result).toEqual({
      alreadyAvailable: true,
      added: false,
    });
    expect(env.PATH).toBe(binDir);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("prepends cwd bin path when command is missing from PATH", () => {
    const cwd = createTempDir("opengoat-cwd-bin-");
    const cwdBin = join(cwd, "bin");
    writeCommandFile(cwdBin);

    const existingPath = createTempDir("opengoat-existing-path-");
    const env = { PATH: existingPath };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = ensureOpenGoatCommandOnPath({
      env,
      logger,
      cwd,
    });

    expect(result).toEqual({
      alreadyAvailable: false,
      added: true,
      addedPath: cwdBin,
    });
    expect(env.PATH).toBe([cwdBin, existingPath].join(delimiter));
    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("finds command in node_modules/.bin relative to plugin source", () => {
    const root = createTempDir("opengoat-plugin-root-");
    const pluginSource = join(
      root,
      "node_modules",
      "@opengoat",
      "openclaw-plugin",
      "index.js",
    );
    mkdirSync(join(root, "node_modules", "@opengoat", "openclaw-plugin"), {
      recursive: true,
    });
    writeFileSync(pluginSource, "", "utf8");

    const nodeModulesBin = join(root, "node_modules", ".bin");
    writeCommandFile(nodeModulesBin);

    const env = { PATH: "" };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = ensureOpenGoatCommandOnPath({
      env,
      logger,
      cwd: createTempDir("opengoat-unrelated-cwd-"),
      pluginSource,
    });

    expect(result).toEqual({
      alreadyAvailable: false,
      added: true,
      addedPath: nodeModulesBin,
    });
    expect(env.PATH).toBe(nodeModulesBin);
    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns when command cannot be discovered", () => {
    const env = { PATH: "" };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const result = ensureOpenGoatCommandOnPath({
      env,
      logger,
      cwd: createTempDir("opengoat-empty-cwd-"),
      pluginSource: join(createTempDir("opengoat-empty-plugin-"), "index.ts"),
    });

    expect(result).toEqual({
      alreadyAvailable: false,
      added: false,
    });
    expect(env.PATH).toBe("");
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
