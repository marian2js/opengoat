import { describe, expect, it } from "vitest";
import { formatRelativeTime, taskStatusLabel, taskStatusPillClasses } from "./utils";

describe("taskStatusLabel", () => {
  it("maps known statuses to user-friendly labels", () => {
    expect(taskStatusLabel("todo")).toBe("To do");
    expect(taskStatusLabel("doing")).toBe("In progress");
    expect(taskStatusLabel("pending")).toBe("Pending");
    expect(taskStatusLabel("blocked")).toBe("Blocked");
    expect(taskStatusLabel("done")).toBe("Done");
  });

  it("normalizes whitespace and casing", () => {
    expect(taskStatusLabel("  DoInG ")).toBe("In progress");
  });

  it("returns unknown statuses unchanged", () => {
    expect(taskStatusLabel("needs-review")).toBe("needs-review");
  });
});

describe("taskStatusPillClasses", () => {
  it("returns the done style for done tasks", () => {
    expect(taskStatusPillClasses("done")).toBe("bg-success/20 text-success");
  });

  it("returns in-progress style for doing tasks", () => {
    expect(taskStatusPillClasses("doing")).toBe(
      "bg-sky-500/20 text-sky-300",
    );
  });

  it("returns blocked style for blocked tasks", () => {
    expect(taskStatusPillClasses("blocked")).toBe(
      "bg-amber-500/20 text-amber-300",
    );
  });

  it("falls back to default style for unknown statuses", () => {
    expect(taskStatusPillClasses("todo")).toBe("bg-accent text-foreground");
    expect(taskStatusPillClasses(" unknown ")).toBe(
      "bg-accent text-foreground",
    );
  });
});

describe("formatRelativeTime", () => {
  const reference = Date.parse("2026-02-18T12:00:00.000Z");

  it("formats recent timestamps as just now", () => {
    expect(
      formatRelativeTime("2026-02-18T11:59:45.000Z", reference),
    ).toBe("just now");
  });

  it("formats minutes and hours ago", () => {
    expect(
      formatRelativeTime("2026-02-18T11:58:00.000Z", reference),
    ).toContain("minute");
    expect(
      formatRelativeTime("2026-02-18T10:00:00.000Z", reference),
    ).toContain("hour");
  });

  it("formats days and months ago", () => {
    expect(
      formatRelativeTime("2026-02-15T12:00:00.000Z", reference),
    ).toContain("day");
    expect(
      formatRelativeTime("2025-12-18T12:00:00.000Z", reference),
    ).toContain("month");
  });

  it("returns unknown for invalid timestamps", () => {
    expect(formatRelativeTime("not-a-date", reference)).toBe("unknown");
  });
});
