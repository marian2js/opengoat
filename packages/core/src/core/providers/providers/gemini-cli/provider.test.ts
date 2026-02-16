import { describe, expect, it } from "vitest";
import { GeminiCliProvider, parseGeminiCliResponse } from "./provider.js";

describe("gemini-cli provider", () => {
  it("does not support auth command execution", () => {
    const provider = new GeminiCliProvider();
    expect(provider.capabilities.auth).toBe(false);
  });

  it("maps standard invocation to gemini headless json mode", () => {
    const provider = new GeminiCliProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      model: "gemini-2.5-pro",
      passthroughArgs: ["--sandbox", "false"],
    });

    expect(invocation.command).toBe("gemini");
    expect(invocation.args).toEqual([
      "-p",
      "ship",
      "--output-format",
      "json",
      "--yolo",
      "--model",
      "gemini-2.5-pro",
      "--sandbox",
      "false",
    ]);
  });

  it("maps session invocation to gemini --resume", () => {
    const provider = new GeminiCliProvider();
    const invocation = provider.buildInvocation({
      message: "continue",
      providerSessionId: "f0363b08-ec9b-4d66-be43-d9730994616c",
      model: "gemini-2.5-flash",
    });

    expect(invocation.args).toEqual([
      "-p",
      "continue",
      "--output-format",
      "json",
      "--yolo",
      "--resume",
      "f0363b08-ec9b-4d66-be43-d9730994616c",
      "--model",
      "gemini-2.5-flash",
    ]);
  });

  it("parses structured json output with response and session id", () => {
    const parsed = parseGeminiCliResponse(
      JSON.stringify({
        session_id: "f0363b08-ec9b-4d66-be43-d9730994616c",
        response: "Done.",
      }),
    );

    expect(parsed).toEqual({
      assistantText: "Done.",
      providerSessionId: "f0363b08-ec9b-4d66-be43-d9730994616c",
    });
  });

  it("parses stream-json assistant message deltas", () => {
    const parsed = parseGeminiCliResponse(
      [
        JSON.stringify({
          type: "init",
          session_id: "f0363b08-ec9b-4d66-be43-d9730994616c",
        }),
        JSON.stringify({
          type: "message",
          role: "assistant",
          content: "Hello",
          delta: true,
        }),
        JSON.stringify({
          type: "message",
          role: "assistant",
          content: "world",
          delta: true,
        }),
      ].join("\n"),
    );

    expect(parsed).toEqual({
      assistantText: "Hello\n\nworld",
      providerSessionId: "f0363b08-ec9b-4d66-be43-d9730994616c",
    });
  });

  it("extracts session id from error-only json output", () => {
    const parsed = parseGeminiCliResponse(
      JSON.stringify({
        session_id: "f0363b08-ec9b-4d66-be43-d9730994616c",
        error: {
          type: "Error",
          message: "Please set GEMINI_API_KEY",
          code: 41,
        },
      }),
    );

    expect(parsed).toEqual({
      assistantText: undefined,
      providerSessionId: "f0363b08-ec9b-4d66-be43-d9730994616c",
    });
  });
});
