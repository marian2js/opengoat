import { describe, expect, it } from "vitest";
import { CursorProvider, parseCursorAgentResponse } from "./provider.js";

describe("cursor provider", () => {
  it("maps standard invocation to cursor agent print json mode", () => {
    const provider = new CursorProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      model: "gpt-5",
      passthroughArgs: ["--sandbox", "enabled"],
    });

    expect(invocation.command).toBe("cursor");
    expect(invocation.args).toEqual([
      "agent",
      "--print",
      "--output-format",
      "json",
      "--model",
      "gpt-5",
      "--sandbox",
      "enabled",
      "--force",
      "--sandbox",
      "disabled",
      "--trust",
      "ship",
    ]);
  });

  it("maps session invocation to cursor agent --resume", () => {
    const provider = new CursorProvider();
    const invocation = provider.buildInvocation({
      message: "continue",
      providerSessionId: "ebc4fe56-cd8c-453e-a894-f3cf2ebf51ae",
      model: "gpt-5",
    });

    expect(invocation.args).toEqual([
      "agent",
      "--print",
      "--output-format",
      "json",
      "--resume",
      "ebc4fe56-cd8c-453e-a894-f3cf2ebf51ae",
      "--model",
      "gpt-5",
      "--force",
      "--sandbox",
      "disabled",
      "--trust",
      "continue",
    ]);
  });

  it("uses cursor-agent binary directly when CURSOR_CMD points to cursor-agent", () => {
    const provider = new CursorProvider();
    const invocation = provider.buildInvocation(
      {
        message: "ship",
      },
      {
        CURSOR_CMD: "cursor-agent",
      },
    );

    expect(invocation.command).toBe("cursor-agent");
    expect(invocation.args).toEqual([
      "--print",
      "--output-format",
      "json",
      "--force",
      "--sandbox",
      "disabled",
      "--trust",
      "ship",
    ]);
  });

  it("maps auth invocation to cursor agent login", () => {
    const provider = new CursorProvider();
    const invocation = provider.buildAuthInvocation({
      passthroughArgs: ["--help"],
    });

    expect(invocation.command).toBe("cursor");
    expect(invocation.args).toEqual(["agent", "login", "--help"]);
  });

  it("parses cursor json output into assistant text and session id", () => {
    const parsed = parseCursorAgentResponse(
      JSON.stringify({
        type: "result",
        subtype: "success",
        result: "Hi!",
        session_id: "dbca8c97-0e64-420c-baf9-3c03e29678a8",
      }),
    );

    expect(parsed).toEqual({
      assistantText: "Hi!",
      providerSessionId: "dbca8c97-0e64-420c-baf9-3c03e29678a8",
    });
  });
});
