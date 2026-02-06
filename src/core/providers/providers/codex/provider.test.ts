import { describe, expect, it } from "vitest";
import { CodexProvider } from "./provider.js";

describe("codex provider", () => {
  it("maps invoke options to codex exec", () => {
    const provider = new CodexProvider();
    const invocation = provider.buildInvocation({
      message: "ping",
      model: "o3",
      passthroughArgs: ["--color", "never"]
    });

    expect(invocation.command).toBe("codex");
    expect(invocation.args).toEqual([
      "exec",
      "--skip-git-repo-check",
      "--model",
      "o3",
      "--color",
      "never",
      "ping"
    ]);
  });

  it("prepends system prompt for CLI providers", () => {
    const provider = new CodexProvider();
    const invocation = provider.buildInvocation({
      message: "ping",
      systemPrompt: "You are an orchestrator."
    });

    expect(invocation.args[invocation.args.length - 1]).toBe(
      "You are an orchestrator.\n\n# User Message\nping"
    );
  });

  it("maps auth invocation", () => {
    const provider = new CodexProvider();
    const invocation = provider.buildAuthInvocation({ passthroughArgs: ["--device-auth"] });

    expect(invocation.command).toBe("codex");
    expect(invocation.args).toEqual(["login", "--device-auth"]);
  });
});
