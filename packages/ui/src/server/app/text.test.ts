import { describe, expect, it } from "vitest";
import { formatRunStatusMessage } from "./text.js";

describe("formatRunStatusMessage", () => {
  it("uses provider display names for provider invocation events", () => {
    expect(
      formatRunStatusMessage({
        stage: "provider_invocation_started",
        timestamp: "2026-02-18T00:00:00.000Z",
        runId: "run-1",
        providerId: "codex",
      }),
    ).toBe("Sending request to Codex.");

    expect(
      formatRunStatusMessage({
        stage: "provider_invocation_started",
        timestamp: "2026-02-18T00:00:00.000Z",
        runId: "run-2",
        providerId: "gemini-cli",
      }),
    ).toBe("Sending request to Gemini CLI.");
  });

  it("falls back to a generic provider label when provider id is missing", () => {
    expect(
      formatRunStatusMessage({
        stage: "provider_invocation_started",
        timestamp: "2026-02-18T00:00:00.000Z",
        runId: "run-3",
      }),
    ).toBe("Sending request to provider.");
  });
});
