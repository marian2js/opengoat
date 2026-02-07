import { describe, expect, it } from "vitest";
import { attachProviderSessionId, extractProviderSessionId } from "./provider-session.js";

describe("provider session helpers", () => {
  it("extracts provider session id from JSON-like payload", () => {
    const value = extractProviderSessionId('{"type":"event","sessionID":"abc-123"}');
    expect(value).toBe("abc-123");
  });

  it("extracts provider session id from plain text", () => {
    const value = extractProviderSessionId("Session ID: task-thread-42");
    expect(value).toBe("task-thread-42");
  });

  it("keeps explicit fallback provider session id", () => {
    const result = attachProviderSessionId(
      {
        code: 0,
        stdout: "session: ignored",
        stderr: ""
      },
      "explicit-session"
    );
    expect(result.providerSessionId).toBe("explicit-session");
  });
});
