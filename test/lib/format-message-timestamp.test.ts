import { describe, expect, it } from "vitest";
import { formatMessageTimestamp } from "../../apps/desktop/src/lib/format-message-timestamp";

describe("formatMessageTimestamp", () => {
  it("returns empty string for invalid date", () => {
    expect(formatMessageTimestamp("invalid")).toBe("");
  });

  it("returns time-only for today's messages", () => {
    const now = new Date();
    now.setHours(15, 46, 0, 0);
    const result = formatMessageTimestamp(now);
    // Should be just a time string like "3:46 PM"
    expect(result).toMatch(/^\d{1,2}:\d{2}\s[AP]M$/);
    expect(result).not.toContain("Yesterday");
  });

  it("returns 'Yesterday' prefix for yesterday's messages", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 30, 0, 0);
    const result = formatMessageTimestamp(yesterday);
    expect(result).toMatch(/^Yesterday\s\d{1,2}:\d{2}\s[AP]M$/);
  });

  it("returns month + day + time for older messages", () => {
    const oldDate = new Date(2025, 2, 27, 15, 46, 0); // Mar 27
    const result = formatMessageTimestamp(oldDate);
    expect(result).toMatch(/^[A-Z][a-z]{2}\s\d{1,2}\s\d{1,2}:\d{2}\s[AP]M$/);
    expect(result).toContain("Mar");
    expect(result).toContain("27");
  });

  it("handles string date input", () => {
    const result = formatMessageTimestamp("2025-03-27T15:46:00Z");
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles numeric timestamp input", () => {
    const result = formatMessageTimestamp(Date.now());
    expect(result).toMatch(/^\d{1,2}:\d{2}\s[AP]M$/);
  });

  it("returns empty string for null-ish inputs coerced to invalid date", () => {
    expect(formatMessageTimestamp(NaN)).toBe("");
  });
});
