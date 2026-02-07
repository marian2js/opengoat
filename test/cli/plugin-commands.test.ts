import { describe, expect, it, vi } from "vitest";
import { pluginCommand } from "../../src/apps/cli/commands/plugin.command.js";
import { pluginDisableCommand } from "../../src/apps/cli/commands/plugin-disable.command.js";
import { pluginDoctorCommand } from "../../src/apps/cli/commands/plugin-doctor.command.js";
import { pluginEnableCommand } from "../../src/apps/cli/commands/plugin-enable.command.js";
import { pluginInfoCommand } from "../../src/apps/cli/commands/plugin-info.command.js";
import { pluginInstallCommand } from "../../src/apps/cli/commands/plugin-install.command.js";
import { pluginListCommand } from "../../src/apps/cli/commands/plugin-list.command.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

function createContext(service: unknown) {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  return {
    context: {
      service: service as never,
      stdout: stdout.stream,
      stderr: stderr.stream
    },
    stdout,
    stderr
  };
}

describe("plugin commands", () => {
  it("prints plugin help", async () => {
    const { context, stdout } = createContext({});
    const code = await pluginCommand.run([], context);

    expect(code).toBe(0);
    expect(stdout.output()).toContain("opengoat plugin list");
    expect(stdout.output()).toContain("opengoat plugin install");
  });

  it("lists plugins and forwards list flags", async () => {
    const listPlugins = vi.fn(async () => ({
      plugins: [
        {
          id: "my-plugin",
          source: "extensions/my-plugin",
          origin: "workspace",
          enabled: true,
          status: "loaded"
        }
      ],
      diagnostics: []
    }));
    const { context, stdout } = createContext({ listPlugins });

    const code = await pluginListCommand.run(["--enabled", "--verbose", "--all"], context);

    expect(code).toBe(0);
    expect(listPlugins).toHaveBeenCalledWith({
      enabledOnly: true,
      verbose: true,
      includeBundled: true
    });
    expect(stdout.output()).toContain("my-plugin\tloaded\tenabled=true");
  });

  it("installs plugin with link option", async () => {
    const installPlugin = vi.fn(async () => ({
      code: 0,
      stdout: "Installed plugin.\n",
      stderr: "",
      installedPluginId: "demo-plugin"
    }));
    const { context, stdout } = createContext({ installPlugin });

    const code = await pluginInstallCommand.run(["demo-plugin", "--link"], context);

    expect(code).toBe(0);
    expect(installPlugin).toHaveBeenCalledWith({
      spec: "demo-plugin",
      link: true
    });
    expect(stdout.output()).toContain("Plugin id: demo-plugin");
  });

  it("shows plugin info and supports json", async () => {
    const getPluginInfo = vi.fn(async () => ({
      id: "demo-plugin",
      source: "extensions/demo-plugin",
      origin: "workspace",
      enabled: true,
      status: "loaded",
      description: "Demo"
    }));
    const plain = createContext({ getPluginInfo });
    const json = createContext({ getPluginInfo });

    expect(await pluginInfoCommand.run(["demo-plugin"], plain.context)).toBe(0);
    expect(plain.stdout.output()).toContain("id: demo-plugin");

    expect(await pluginInfoCommand.run(["demo-plugin", "--json"], json.context)).toBe(0);
    expect(json.stdout.output()).toContain('"id": "demo-plugin"');
  });

  it("enables and disables plugins", async () => {
    const enablePlugin = vi.fn(async () => undefined);
    const disablePlugin = vi.fn(async () => undefined);

    const enable = createContext({ enablePlugin });
    expect(await pluginEnableCommand.run(["demo-plugin"], enable.context)).toBe(0);
    expect(enablePlugin).toHaveBeenCalledWith("demo-plugin");

    const disable = createContext({ disablePlugin });
    expect(await pluginDisableCommand.run(["demo-plugin"], disable.context)).toBe(0);
    expect(disablePlugin).toHaveBeenCalledWith("demo-plugin");
  });

  it("runs plugin doctor and returns upstream code", async () => {
    const pluginDoctor = vi.fn(async () => ({
      code: 2,
      stdout: "",
      stderr: "doctor found issues\n"
    }));
    const { context, stderr } = createContext({ pluginDoctor });

    const code = await pluginDoctorCommand.run([], context);
    expect(code).toBe(2);
    expect(stderr.output()).toContain("doctor found issues");
  });
});
