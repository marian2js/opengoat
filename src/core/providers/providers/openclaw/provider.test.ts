import { describe, expect, it } from "vitest";
import { OpenClawProvider } from "./provider.js";

describe("openclaw provider", () => {
  it("maps invoke options", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      agent: "builder",
      model: "gpt-5",
      passthroughArgs: ["--full-auto"]
    });

    expect(invocation.command).toBe("openclaw");
    expect(invocation.args).toEqual([
      "agent",
      "builder",
      "--model",
      "gpt-5",
      "--full-auto",
      "--message",
      "ship"
    ]);
  });

  it("maps auth invocation with and without passthrough args", () => {
    const provider = new OpenClawProvider();

    const defaultInvocation = provider.buildAuthInvocation({});
    expect(defaultInvocation.command).toBe("openclaw");
    expect(defaultInvocation.args).toEqual(["onboard"]);

    const passthroughInvocation = provider.buildAuthInvocation({
      passthroughArgs: ["--provider", "openai-codex"]
    });
    expect(passthroughInvocation.args).toEqual([
      "models",
      "auth",
      "login",
      "--provider",
      "openai-codex"
    ]);
  });
});
