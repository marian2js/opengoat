import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";
import plugin from "../index.js";
import type {
  OpenClawPluginApiLike,
  OpenClawPluginToolFactoryLike,
  PluginCliRegistrarLike,
  PluginLogger,
} from "./openclaw-types.js";

class FakePluginApi implements OpenClawPluginApiLike {
  public source = "/tmp/plugin/index.ts";
  public pluginConfig = {};
  public logger: PluginLogger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

  public readonly cliRegistrars: PluginCliRegistrarLike[] = [];
  public readonly toolRegistrations: Array<
    OpenClawPluginToolFactoryLike | Record<string, unknown>
  > = [];

  public registerCli(registrar: PluginCliRegistrarLike): void {
    this.cliRegistrars.push(registrar);
  }

  public registerTool(
    tool: OpenClawPluginToolFactoryLike | Record<string, unknown>,
    _opts?: { optional?: boolean; name?: string; names?: string[] },
  ): void {
    this.toolRegistrations.push(tool);
  }
}

describe("openclaw plugin entrypoint", () => {
  it("registers CLI bridge and tool factories", () => {
    const api = new FakePluginApi();

    plugin.register(api);

    expect(api.cliRegistrars.length).toBe(1);
    expect(api.toolRegistrations.length).toBeGreaterThan(20);
  });

  it("bootstraps PATH with local bin directory when opengoat is unavailable", () => {
    const cwd = mkdtempSync(join(tmpdir(), "opengoat-plugin-entry-"));
    const binDir = join(cwd, "bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "opengoat"), "#!/usr/bin/env node\n", "utf8");

    const originalCwd = process.cwd();
    const originalPath = process.env.PATH;

    try {
      process.chdir(cwd);
      process.env.PATH = "";

      plugin.register(new FakePluginApi());

      const firstPathEntry = (process.env.PATH ?? "").split(delimiter)[0];
      expect(realpathSync(firstPathEntry)).toBe(realpathSync(binDir));
    } finally {
      process.chdir(originalCwd);
      process.env.PATH = originalPath;
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
