import { describe, expect, it } from "vitest";
import type {
  OpenClawPluginApiLike,
  OpenClawPluginToolFactoryLike,
  PluginCliRegistrarLike,
  PluginLogger,
} from "../openclaw-types.js";
import { registerOpenGoatTools } from "./register-tools.js";

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

describe("openclaw plugin tool registration", () => {
  it("registers all OpenGoat tool definitions", () => {
    const api = new FakePluginApi();

    const toolNames = registerOpenGoatTools(api);

    expect(toolNames.length).toBeGreaterThanOrEqual(25);
    expect(new Set(toolNames).size).toBe(toolNames.length);
    expect(toolNames).toContain("opengoat_agent_info");
    expect(toolNames).toContain("opengoat_task_create");
    expect(toolNames).toContain("opengoat_session_history");
    expect(toolNames).not.toContain("opengoat_agent_provider_get");
    expect(toolNames).not.toContain("opengoat_agent_provider_set");
    expect(toolNames).not.toContain("opengoat_skill_list");
    expect(toolNames).not.toContain("opengoat_provider_list");
    expect(toolNames).not.toContain("opengoat_gateway_config_get");
    expect(toolNames).not.toContain("opengoat_runtime_paths");
    expect(api.toolRegistrations.length).toBe(toolNames.length);
  });
});
