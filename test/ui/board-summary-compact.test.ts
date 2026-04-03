import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/BoardSummary.tsx",
  ),
  "utf-8",
);

describe("BoardSummary compact layout", () => {
  it("does NOT render per-status pills (OPEN, BLOCKED, PENDING REVIEW, DONE)", () => {
    // The old pills function and status labels should be removed
    expect(src).not.toContain("getPills");
    expect(src).not.toContain('"OPEN"');
    expect(src).not.toContain('"BLOCKED"');
    expect(src).not.toContain('"PENDING REVIEW"');
    expect(src).not.toContain('"DONE"');
  });

  it("shows a total count", () => {
    expect(src).toContain("total");
  });

  it("has a link to #board", () => {
    expect(src).toContain("#board");
  });

  it("does NOT render activeObjective section", () => {
    expect(src).not.toContain("activeObjective");
    expect(src).not.toContain("TargetIcon");
  });

  it("self-hides when empty", () => {
    expect(src).toContain("isEmpty");
    expect(src).toContain("return null");
  });

  it("renders as a minimal inline strip", () => {
    // Should have Board label and icon
    expect(src).toContain("Board");
    expect(src).toContain("ClipboardListIcon");
  });

  it("does not accept activeObjective prop", () => {
    expect(src).not.toContain("activeObjective");
  });
});
