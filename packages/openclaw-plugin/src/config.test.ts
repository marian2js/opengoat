import { describe, expect, it } from "vitest";
import { parseOpenGoatPluginConfig } from "./config.js";

describe("openclaw plugin config parsing", () => {
  it("uses the default command with empty config", () => {
    const parsed = parseOpenGoatPluginConfig(undefined, {});

    expect(parsed).toEqual({
      command: "opengoat",
      baseArgs: [],
      cwd: undefined,
      env: {},
    });
  });

  it("supports command override from environment", () => {
    const parsed = parseOpenGoatPluginConfig(undefined, {
      OPENGOAT_PLUGIN_COMMAND: "  ./bin/opengoat  ",
    });

    expect(parsed.command).toBe("./bin/opengoat");
  });

  it("parses explicit plugin config and drops invalid values", () => {
    const parsed = parseOpenGoatPluginConfig(
      {
        command: " custom-opengoat ",
        baseArgs: ["--log-format", "json", "", 123],
        cwd: " /tmp/opengoat ",
        env: {
          FOO: " bar ",
          EMPTY: "  ",
          OTHER: 42,
        },
      },
      {},
    );

    expect(parsed).toEqual({
      command: "custom-opengoat",
      baseArgs: ["--log-format", "json"],
      cwd: "/tmp/opengoat",
      env: {
        FOO: "bar",
      },
    });
  });
});
