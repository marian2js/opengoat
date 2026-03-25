import { describe, expect, it } from "vitest";
import { isUuidLikeLabel, humanizeSessionLabel } from "../../apps/desktop/src/lib/utils/session-label";

describe("isUuidLikeLabel", () => {
  it("detects 8-char hex string as UUID-like", () => {
    expect(isUuidLikeLabel("f1a26b39")).toBe(true);
  });

  it("detects full UUID as UUID-like", () => {
    expect(isUuidLikeLabel("f1a26b39-abcd-1234-5678-123456789abc")).toBe(true);
  });

  it("detects 8-char hex with date suffix", () => {
    expect(isUuidLikeLabel("15480b2f (2026-03-22)")).toBe(true);
  });

  it("does not flag normal conversation title", () => {
    expect(isUuidLikeLabel("Find launch communities")).toBe(false);
  });

  it("does not flag empty string", () => {
    expect(isUuidLikeLabel("")).toBe(false);
  });

  it("does not flag undefined", () => {
    expect(isUuidLikeLabel(undefined)).toBe(false);
  });
});

describe("humanizeSessionLabel", () => {
  it("returns descriptive label unchanged", () => {
    expect(humanizeSessionLabel("Find launch communities", "2026-03-22T10:00:00Z"))
      .toBe("Find launch communities");
  });

  it("returns 'New chat' for UUID label", () => {
    expect(humanizeSessionLabel("f1a26b39 (2026-03-22)", "2026-03-22T10:00:00Z"))
      .toBe("New chat");
  });

  it("returns 'New chat' for full UUID label", () => {
    expect(humanizeSessionLabel("f1a26b39-abcd-1234-5678-123456789abc", "2026-03-22T10:00:00Z"))
      .toBe("New chat");
  });

  it("returns 'New chat' for undefined label", () => {
    expect(humanizeSessionLabel(undefined, "2026-03-22T10:00:00Z"))
      .toBe("New chat");
  });

  it("returns 'New chat' for empty label", () => {
    expect(humanizeSessionLabel("", "2026-03-22T10:00:00Z"))
      .toBe("New chat");
  });

  it("returns 'New chat' for invalid date (no longer date-based)", () => {
    expect(humanizeSessionLabel("f1a26b39", "invalid-date"))
      .toBe("New chat");
  });

  it("preserves action labels with run numbers", () => {
    expect(humanizeSessionLabel("Draft Product Hunt launch (4)", "2026-03-22T10:00:00Z"))
      .toBe("Draft Product Hunt launch (4)");
  });

  it("truncates long labels to 55 characters", () => {
    const longLabel = "This is a very long conversation title that definitely should be truncated at some point soon";
    const result = humanizeSessionLabel(longLabel, "2026-03-22T10:00:00Z");
    expect(result.length).toBeLessThanOrEqual(55);
    expect(result).toMatch(/\.\.\.$/);
  });

  it("does not truncate labels at exactly 55 chars", () => {
    const label = "A".repeat(55);
    expect(humanizeSessionLabel(label, "2026-03-22T10:00:00Z")).toBe(label);
  });

  it("does not show 'Chat — Mar 25' format anymore", () => {
    const result = humanizeSessionLabel(undefined, "2026-03-25T10:00:00Z");
    expect(result).not.toMatch(/^Chat \u2014/);
    expect(result).toBe("New chat");
  });
});
