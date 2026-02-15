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
    const originalArgv = process.argv;
    process.argv = ["node", "openclaw", "gateway", "call", "agent"];

    try {
      plugin.register(api);
    } finally {
      process.argv = originalArgv;
    }

    expect(api.cliRegistrars.length).toBe(1);
    expect(api.toolRegistrations.length).toBeGreaterThan(15);
  });

  it("bootstraps PATH with local bin directory when opengoat is unavailable", () => {
    const cwd = mkdtempSync(join(tmpdir(), "opengoat-plugin-entry-"));
    const binDir = join(cwd, "bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "opengoat"), "#!/usr/bin/env node\n", "utf8");

    const originalCwd = process.cwd();
    const originalPath = process.env.PATH;
    const originalArgv = process.argv;

    try {
      process.chdir(cwd);
      process.env.PATH = "";
      process.argv = ["node", "openclaw", "gateway", "call", "agent"];

      plugin.register(new FakePluginApi());

      const firstPathEntry = (process.env.PATH ?? "").split(delimiter)[0];
      expect(realpathSync(firstPathEntry)).toBe(realpathSync(binDir));
    } finally {
      process.chdir(originalCwd);
      process.env.PATH = originalPath;
      process.argv = originalArgv;
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("registers tools for each plugin registry load", () => {
    const firstApi = new FakePluginApi();
    firstApi.source = "/tmp/plugin-a/index.ts";
    const secondApi = new FakePluginApi();
    secondApi.source = "/tmp/plugin-b/index.ts";
    const originalArgv = process.argv;
    process.argv = ["node", "openclaw", "gateway", "call", "agent"];

    try {
      plugin.register(firstApi);
      plugin.register(secondApi);
    } finally {
      process.argv = originalArgv;
    }

    expect(firstApi.cliRegistrars.length).toBe(1);
    expect(firstApi.toolRegistrations.length).toBeGreaterThan(15);
    expect(secondApi.cliRegistrars.length).toBe(1);
    expect(secondApi.toolRegistrations.length).toBeGreaterThan(15);
  });

  it("skips tool registration for generic openclaw calls", () => {
    const api = new FakePluginApi();
    const originalArgv = process.argv;
    process.argv = ["node", "openclaw"];

    try {
      plugin.register(api);
    } finally {
      process.argv = originalArgv;
    }

    expect(api.cliRegistrars.length).toBe(1);
    expect(api.toolRegistrations.length).toBe(0);
  });
});
