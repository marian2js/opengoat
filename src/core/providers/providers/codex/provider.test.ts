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

  it("maps auth invocation", () => {
    const provider = new CodexProvider();
    const invocation = provider.buildAuthInvocation({ passthroughArgs: ["--device-auth"] });

    expect(invocation.command).toBe("codex");
    expect(invocation.args).toEqual(["login", "--device-auth"]);
  });
});
