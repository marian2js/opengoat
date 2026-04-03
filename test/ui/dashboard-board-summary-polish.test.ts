import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardSummarySrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/BoardSummary.tsx",
  ),
  "utf-8",
);

describe("Dashboard Board Summary – compact count-only strip", () => {
  // Board summary is now a minimal inline strip (no pills, no active objective)
  describe("Compact layout", () => {
    it("shows a total count", () => {
      expect(boardSummarySrc).toContain("total");
    });

    it("does not show per-status pills", () => {
      expect(boardSummarySrc).not.toContain("getPills");
      expect(boardSummarySrc).not.toContain('"OPEN"');
      expect(boardSummarySrc).not.toContain('"BLOCKED"');
    });
  });

  // Empty state returns null — hidden per spec (no empty sections on dashboard)
  describe("Empty state behavior", () => {
    it("returns null when empty to avoid showing empty sections", () => {
      const afterIsEmpty = boardSummarySrc.split(/if\s*\(isEmpty\)/)[1];
      expect(afterIsEmpty).toBeTruthy();
      expect(afterIsEmpty).toContain("return null");
    });
  });

  // Populated state has View link
  describe("Populated state", () => {
    it("shows a View link to the board", () => {
      expect(boardSummarySrc).toContain("View");
      expect(boardSummarySrc).toContain("#board");
    });

    it("has an ArrowRightIcon for the link", () => {
      expect(boardSummarySrc).toContain("ArrowRightIcon");
    });
  });
});
