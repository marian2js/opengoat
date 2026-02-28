import { describe, expect, it } from "vitest";
import {
  formatRunStatusMessage,
  sanitizeConversationText,
  sanitizeRuntimeProgressChunk,
} from "./text.js";

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

describe("sanitizeConversationText", () => {
  it("removes stale OpenClaw plugin warning blocks", () => {
    const input = [
      "◇ Config warnings",
      "│ - plugins.entries.opengoat-plugin: plugin not found: opengoat-plugin (stale config entry ignored; remove it from plugins config)",
      "│ - plugins.entries.openclaw-plugin-pack: plugin not found: openclaw-plugin-pack (stale config entry ignored; remove it from plugins config)",
      "└────────────────────────────────────────────",
      "## Proposed Roadmap",
      "Ship MVP in 7 days.",
    ].join("\n");

    expect(sanitizeConversationText(input)).toBe(
      "## Proposed Roadmap\nShip MVP in 7 days.",
    );
  });

  it("returns empty output when payload only contains stale warning lines", () => {
    const input =
      "Config warnings:\n- plugins.entries.workspace: plugin not found: workspace (stale config entry ignored; remove it from plugins config)";
    expect(sanitizeConversationText(input)).toBe("");
  });

  it("removes wrapped box lines that belong to leading stale warning blocks", () => {
    const input = [
      "│",
      "◇  Config warnings ────────────────────────────────────────────────────────╮",
      "│                                                                          │",
      "│  - plugins.entries.opengoat-plugin: plugin not found: opengoat-plugin    │",
      "│    (stale config entry ignored; remove it from plugins config)           │",
      "│                                                                          │",
      "├──────────────────────────────────────────────────────────────────────────╯",
      "## Proposed Roadmap",
      "Day 1: Validate scope.",
    ].join("\n");

    expect(sanitizeConversationText(input)).toBe(
      "## Proposed Roadmap\nDay 1: Validate scope.",
    );
  });
});

describe("sanitizeRuntimeProgressChunk", () => {
  it("filters stale OpenClaw warning lines from runtime chunks", () => {
    const input =
      "Config warnings:\n- plugins.entries.opengoat-plugin: plugin not found: opengoat-plugin (stale config entry ignored; remove it from plugins config)\nStarting @goat.";
    expect(sanitizeRuntimeProgressChunk(input)).toBe("Starting @goat.");
  });
});
