import { describe, expect, it } from "vitest";
import { OpenCodeProvider, parseOpenCodeRunResponse } from "./provider.js";

describe("opencode provider", () => {
  it("maps standard invocation to opencode run json mode", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      model: "openai/gpt-5",
      passthroughArgs: ["--thinking"],
    });

    expect(invocation.command).toBe("opencode");
    expect(invocation.args).toEqual([
      "run",
      "--format",
      "json",
      "--model",
      "openai/gpt-5",
      "--thinking",
      "ship",
    ]);
  });

  it("maps session invocation to opencode run --session", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildInvocation({
      message: "continue",
      providerSessionId: "ses_3998c0cbaffeWHx78ckcgrEeHK",
      model: "openai/gpt-5",
    });

    expect(invocation.args).toEqual([
      "run",
      "--format",
      "json",
      "--session",
      "ses_3998c0cbaffeWHx78ckcgrEeHK",
      "--model",
      "openai/gpt-5",
      "continue",
    ]);
  });

  it("maps auth invocation to opencode auth login", () => {
    const provider = new OpenCodeProvider();
    const invocation = provider.buildAuthInvocation({
      passthroughArgs: ["openai"],
    });

    expect(invocation.command).toBe("opencode");
    expect(invocation.args).toEqual(["auth", "login", "openai"]);
  });

  it("parses opencode json stream into assistant text and session id", () => {
    const parsed = parseOpenCodeRunResponse(
      [
        JSON.stringify({
          type: "step_start",
          sessionID: "ses_3998c0cbaffeWHx78ckcgrEeHK",
        }),
        JSON.stringify({
          type: "text",
          sessionID: "ses_3998c0cbaffeWHx78ckcgrEeHK",
          part: {
            type: "text",
            text: "hi",
          },
        }),
      ].join("\n"),
    );

    expect(parsed).toEqual({
      assistantText: "hi",
      providerSessionId: "ses_3998c0cbaffeWHx78ckcgrEeHK",
    });
  });

  it("captures session id from records without text", () => {
    const parsed = parseOpenCodeRunResponse(
      JSON.stringify({
        type: "step_start",
        sessionID: "ses_3998c0cbaffeWHx78ckcgrEeHK",
      }),
    );

    expect(parsed).toEqual({
      assistantText: undefined,
      providerSessionId: "ses_3998c0cbaffeWHx78ckcgrEeHK",
    });
  });
});
