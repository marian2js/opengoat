import { describe, expect, it } from "vitest";
import { CopilotCliProvider } from "./provider.js";

describe("copilot-cli provider", () => {
  it("does not support auth command execution", () => {
    const provider = new CopilotCliProvider();
    expect(provider.capabilities.auth).toBe(false);
  });

  it("maps standard invocation to silent prompt mode", () => {
    const provider = new CopilotCliProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      model: "gpt-5",
      passthroughArgs: ["--debug"],
    });

    expect(invocation.command).toBe("copilot");
    expect(invocation.args).toEqual([
      "--prompt",
      "ship",
      "--silent",
      "--model",
      "gpt-5",
      "--debug",
      "--allow-all",
    ]);
  });

  it("maps session invocation to --resume", () => {
    const provider = new CopilotCliProvider();
    const invocation = provider.buildInvocation({
      message: "continue",
      providerSessionId: "ebc4fe56-cd8c-453e-a894-f3cf2ebf51ae",
    });

    expect(invocation.args).toEqual([
      "--prompt",
      "continue",
      "--silent",
      "--resume",
      "ebc4fe56-cd8c-453e-a894-f3cf2ebf51ae",
      "--allow-all",
    ]);
  });
});
