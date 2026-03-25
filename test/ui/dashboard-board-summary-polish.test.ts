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

describe("Dashboard Board Summary – pill colors and empty state polish", () => {
  // AC1: Status pills have visually distinct colors (no two pills share the same color)
  describe("Pill color distinctness", () => {
    it("does not have an 'In Progress' pill (removed as redundant)", () => {
      // "In Progress" is a subset of "Open" — showing both is confusing in a summary
      expect(boardSummarySrc).not.toContain('"In Progress"');
    });

    it("each remaining pill has a unique color class", () => {
      // Extract all className strings from pill definitions
      const classMatches = boardSummarySrc.match(
        /className:\s*"(bg-[^"]+)"/g,
      );
      expect(classMatches).toBeTruthy();
      const classNames = classMatches!.map((m) =>
        m.replace(/className:\s*"/, "").replace(/"$/, ""),
      );
      // All pill classNames should be unique (no two pills share the same color)
      const uniqueClassNames = new Set(classNames);
      expect(uniqueClassNames.size).toBe(classNames.length);
    });
  });

  // AC2: Empty state returns null — hidden per spec (no empty sections on dashboard)
  describe("Empty state behavior", () => {
    it("returns null when empty to avoid showing empty sections", () => {
      const afterIsEmpty = boardSummarySrc.split(/if\s*\(isEmpty\)/)[1];
      expect(afterIsEmpty).toBeTruthy();
      expect(afterIsEmpty).toContain("return null");
    });
  });

  // AC3: Populated state has View Board link
  describe("Populated state", () => {
    it("shows a View Board link in the populated state", () => {
      expect(boardSummarySrc).toContain("View Board");
    });

    it("has an ArrowRightIcon for the link", () => {
      expect(boardSummarySrc).toContain("ArrowRightIcon");
    });
  });
});
