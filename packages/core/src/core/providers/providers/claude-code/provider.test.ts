import { describe, expect, it } from "vitest";
import { ClaudeCodeProvider, parseClaudeCodeResponse } from "./provider.js";

describe("claude-code provider", () => {
  it("maps invoke options to Claude Code headless flags", () => {
    const provider = new ClaudeCodeProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      model: "sonnet",
      systemPrompt: "Follow policy",
      providerSessionId: "session-42",
      passthroughArgs: ["--max-turns", "4"],
    });

    expect(invocation.command).toBe("claude");
    expect(invocation.args).toEqual([
      "-p",
      "ship",
      "--output-format",
      "json",
      "--resume",
      "session-42",
      "--model",
      "sonnet",
      "--append-system-prompt",
      "Follow policy",
      "--max-turns",
      "4",
    ]);
  });

  it("maps auth invocation to claude auth login", () => {
    const provider = new ClaudeCodeProvider();

    const invocation = provider.buildAuthInvocation({
      passthroughArgs: ["--headless"],
    });

    expect(invocation.command).toBe("claude");
    expect(invocation.args).toEqual(["auth", "login", "--headless"]);
  });

  it("parses JSON output with assistant text and session id", () => {
    const parsed = parseClaudeCodeResponse(
      JSON.stringify({
        type: "result",
        subtype: "success",
        result: "Done.",
        session_id: "abc-123",
      }),
    );

    expect(parsed).toEqual({
      assistantText: "Done.",
      providerSessionId: "abc-123",
    });
  });

  it("parses NDJSON and returns the last result event", () => {
    const parsed = parseClaudeCodeResponse(
      [
        JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Working..." }] } }),
        JSON.stringify({ type: "result", result: "Completed", session_id: "session-9000" }),
      ].join("\n"),
    );

    expect(parsed).toEqual({
      assistantText: "Completed",
      providerSessionId: "session-9000",
    });
  });
});
