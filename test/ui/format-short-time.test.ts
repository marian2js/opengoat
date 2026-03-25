import { describe, expect, it } from "vitest";
import { formatShortTime } from "../../apps/desktop/src/lib/utils/format-short-time";

describe("formatShortTime — compact timestamp for sidebar display", () => {
  const today = new Date("2026-03-25T18:00:00Z");

  it("formats today's date as time only (h:mm AM/PM)", () => {
    const result = formatShortTime("2026-03-25T14:15:00Z", today);
    // Should match a time pattern like "2:15 PM" or "7:15 AM"
    expect(result).toMatch(/^\d{1,2}:\d{2}\s[AP]M$/);
  });

  it("formats yesterday as short month and day", () => {
    const result = formatShortTime("2026-03-24T10:30:00Z", today);
    expect(result).toBe("Mar 24");
  });

  it("formats older dates as short month and day", () => {
    const result = formatShortTime("2026-03-10T08:00:00Z", today);
    expect(result).toBe("Mar 10");
  });

  it("formats dates from a different month", () => {
    const result = formatShortTime("2026-02-14T12:00:00Z", today);
    expect(result).toBe("Feb 14");
  });

  it("returns empty string for invalid date", () => {
    const result = formatShortTime("invalid", today);
    expect(result).toBe("");
  });

  it("returns empty string for empty string input", () => {
    const result = formatShortTime("", today);
    expect(result).toBe("");
  });

  it("defaults to current time when now is not provided", () => {
    const result = formatShortTime("2026-03-20T14:15:00Z");
    expect(result.length).toBeGreaterThan(0);
  });
});
