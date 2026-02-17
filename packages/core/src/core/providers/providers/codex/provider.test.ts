import { describe, expect, it } from "vitest";
import { CodexProvider, parseCodexExecResponse } from "./provider.js";

describe("codex provider", () => {
  it("maps standard invocation to codex exec json mode", () => {
    const provider = new CodexProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      model: "gpt-5-codex",
      passthroughArgs: ["--full-auto"],
    });

    expect(invocation.command).toBe("codex");
    expect(invocation.args).toEqual([
      "exec",
      "--json",
      "--skip-git-repo-check",
      "--model",
      "gpt-5-codex",
      "--full-auto",
      "--ask-for-approval",
      "never",
      "--sandbox",
      "danger-full-access",
      "ship",
    ]);
  });

  it("maps session invocation to codex exec resume", () => {
    const provider = new CodexProvider();
    const invocation = provider.buildInvocation({
      message: "continue",
      providerSessionId: "019c663e-3112-7b81-8658-71f7f1bfbb06",
      model: "gpt-5-codex",
    });

    expect(invocation.args).toEqual([
      "exec",
      "resume",
      "--json",
      "--skip-git-repo-check",
      "--model",
      "gpt-5-codex",
      "--ask-for-approval",
      "never",
      "--sandbox",
      "danger-full-access",
      "019c663e-3112-7b81-8658-71f7f1bfbb06",
      "continue",
    ]);
  });

  it("maps auth invocation to codex login", () => {
    const provider = new CodexProvider();
    const invocation = provider.buildAuthInvocation({
      passthroughArgs: ["--with-api-key"],
    });

    expect(invocation.command).toBe("codex");
    expect(invocation.args).toEqual(["login", "--with-api-key"]);
  });

  it("parses codex --json stream into message and thread id", () => {
    const parsed = parseCodexExecResponse(
      [
        JSON.stringify({
          type: "thread.started",
          thread_id: "019c663e-0ff9-7892-a250-6cd7e9d5e1b8",
        }),
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "item_1",
            type: "agent_message",
            text: "Hi",
          },
        }),
      ].join("\n"),
    );

    expect(parsed).toEqual({
      assistantText: "Hi",
      providerSessionId: "019c663e-0ff9-7892-a250-6cd7e9d5e1b8",
    });
  });
});
