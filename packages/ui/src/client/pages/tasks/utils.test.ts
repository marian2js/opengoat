import { describe, expect, it } from "vitest";
import { taskStatusLabel, taskStatusPillClasses } from "./utils";

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
