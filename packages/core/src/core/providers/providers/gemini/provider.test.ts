import { describe, expect, it } from "vitest";
import { UnsupportedProviderActionError } from "../../errors.js";
import { GeminiProvider } from "./provider.js";

describe("gemini provider", () => {
  it("maps invoke options to gemini --prompt mode", () => {
    const provider = new GeminiProvider();
    const invocation = provider.buildInvocation({
      message: "summarize the repository",
      model: "gemini-2.5-pro",
      passthroughArgs: ["--output-format", "json"]
    });

    expect(invocation.command).toBe("gemini");
    expect(invocation.args).toEqual([
      "--model",
      "gemini-2.5-pro",
      "--approval-mode",
      "yolo",
      "--output-format",
      "json",
      "--prompt",
      "summarize the repository"
    ]);
  });

  it("supports default model from GEMINI_MODEL", () => {
    const provider = new GeminiProvider();
    const invocation = provider.buildInvocation(
      { message: "plan next steps" },
      { ...process.env, GEMINI_MODEL: "gemini-2.5-flash" }
    );

    expect(invocation.args).toEqual([
      "--model",
      "gemini-2.5-flash",
      "--approval-mode",
      "yolo",
      "--prompt",
      "plan next steps"
    ]);
  });

  it("prepends system prompt for CLI providers", () => {
    const provider = new GeminiProvider();
    const invocation = provider.buildInvocation({
      message: "ping",
      systemPrompt: "You are an orchestrator."
    });

    expect(invocation.args[invocation.args.length - 1]).toBe(
      "You are an orchestrator.\n\n# User Message\nping"
    );
  });

  it("supports command override with GEMINI_CMD", () => {
    const provider = new GeminiProvider();
    const invocation = provider.buildInvocation(
      { message: "ping" },
      { ...process.env, GEMINI_CMD: "gemini-beta" }
    );

    expect(invocation.command).toBe("gemini-beta");
  });

  it("supports approval mode override via GEMINI_APPROVAL_MODE", () => {
    const provider = new GeminiProvider();
    const invocation = provider.buildInvocation(
      { message: "ping" },
      { ...process.env, GEMINI_APPROVAL_MODE: "auto_edit" }
    );

    expect(invocation.args).toEqual(["--approval-mode", "auto_edit", "--prompt", "ping"]);
  });

  it("does not force approval mode when passthrough already sets it", () => {
    const provider = new GeminiProvider();
    const invocation = provider.buildInvocation({
      message: "ping",
      passthroughArgs: ["--approval-mode", "plan"]
    });

    expect(invocation.args).toEqual(["--approval-mode", "plan", "--prompt", "ping"]);
  });

  it("does not support auth action", () => {
    const provider = new GeminiProvider();
    expect(() => provider.buildAuthInvocation()).toThrow(UnsupportedProviderActionError);
  });
});
