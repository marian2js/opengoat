import { describe, expect, it } from "vitest";
import { OpenCodeProvider } from "./provider.js";

describe("opencode provider", () => {
  it("maps invoke options to opencode run", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation({
      message: "summarize the repository",
      model: "openai/gpt-5",
      passthroughArgs: ["--format", "default"]
    });

    expect(invocation.command).toBe("opencode");
    expect(invocation.args).toEqual([
      "run",
      "--model",
      "openai/gpt-5",
      "--format",
      "default",
      "summarize the repository"
    ]);
  });

  it("supports OPENCODE_MODEL as default model", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation(
      { message: "plan next steps" },
      { ...process.env, OPENCODE_MODEL: "anthropic/claude-sonnet-4" }
    );

    expect(invocation.command).toBe("opencode");
    expect(invocation.args).toEqual(["run", "--model", "anthropic/claude-sonnet-4", "plan next steps"]);
  });

  it("prepends system prompt for CLI providers", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation({
      message: "ping",
      systemPrompt: "You are an orchestrator."
    });

    expect(invocation.args[invocation.args.length - 1]).toBe(
      "You are an orchestrator.\n\n# User Message\nping"
    );
  });

  it("maps auth invocation", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildAuthInvocation({ passthroughArgs: ["https://api.openai.com/v1"] });

    expect(invocation.command).toBe("opencode");
    expect(invocation.args).toEqual(["auth", "login", "https://api.openai.com/v1"]);
  });

  it("supports command override with OPENCODE_CMD", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation(
      { message: "ping" },
      { ...process.env, OPENCODE_CMD: "opencode-beta" }
    );

    expect(invocation.command).toBe("opencode-beta");
  });
});
