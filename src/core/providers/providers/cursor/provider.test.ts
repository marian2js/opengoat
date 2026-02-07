import { describe, expect, it } from "vitest";
import { UnsupportedProviderOptionError } from "../../errors.js";
import { CursorProvider } from "./provider.js";

describe("cursor provider", () => {
  it("uses cursor agent wrapper by default", () => {
    const provider = new CursorProvider();
    const invocation = provider.buildInvocation({ message: "summarize repo" });

    expect(invocation.command).toBe("cursor");
    expect(invocation.args).toEqual(["agent", "summarize repo"]);
  });

  it("supports direct cursor-agent override", () => {
    const provider = new CursorProvider();
    const invocation = provider.buildInvocation(
      { message: "summarize repo" },
      { ...process.env, CURSOR_CMD: "cursor-agent" }
    );

    expect(invocation.command).toBe("cursor-agent");
    expect(invocation.args).toEqual(["summarize repo"]);
  });

  it("maps auth invocation for both wrapper forms", () => {
    const provider = new CursorProvider();

    const defaultInvocation = provider.buildAuthInvocation({});
    expect(defaultInvocation.command).toBe("cursor");
    expect(defaultInvocation.args).toEqual(["agent", "login"]);

    const directInvocation = provider.buildAuthInvocation(
      {},
      { ...process.env, CURSOR_CMD: "cursor-agent" }
    );
    expect(directInvocation.command).toBe("cursor-agent");
    expect(directInvocation.args).toEqual(["login"]);
  });

  it("rejects unsupported model option", () => {
    const provider = new CursorProvider();

    expect(() => provider.buildInvocation({ message: "hi", model: "gpt-5" })).toThrow(
      UnsupportedProviderOptionError
    );
  });

  it("maps provider session id to --resume", () => {
    const provider = new CursorProvider();
    const wrapped = provider.buildInvocation({
      message: "continue work",
      providerSessionId: "chat-123"
    });
    expect(wrapped.args).toEqual(["agent", "--resume", "chat-123", "continue work"]);

    const direct = provider.buildInvocation(
      {
        message: "continue work",
        providerSessionId: "chat-123"
      },
      { ...process.env, CURSOR_CMD: "cursor-agent" }
    );
    expect(direct.args).toEqual(["--resume", "chat-123", "continue work"]);
  });
});
