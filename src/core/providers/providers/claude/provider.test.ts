import { describe, expect, it } from "vitest";
import { ClaudeProvider } from "./provider.js";

describe("claude provider", () => {
  it("maps invoke options including agent/model", () => {
    const provider = new ClaudeProvider();
    const invocation = provider.buildInvocation({
      message: "implement feature",
      agent: "planner",
      model: "sonnet",
      passthroughArgs: ["--max-tokens", "2048"]
    });

    expect(invocation.command).toBe("claude");
    expect(invocation.args).toEqual([
      "--print",
      "--agent",
      "planner",
      "--model",
      "sonnet",
      "--max-tokens",
      "2048",
      "implement feature"
    ]);
  });

  it("maps auth invocation", () => {
    const provider = new ClaudeProvider();
    const invocation = provider.buildAuthInvocation({ passthroughArgs: ["--help"] });

    expect(invocation.command).toBe("claude");
    expect(invocation.args).toEqual(["setup-token", "--help"]);
  });
});
