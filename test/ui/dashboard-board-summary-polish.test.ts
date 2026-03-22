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

  // AC2: Empty state includes a "View Board" link for discoverability
  describe("Empty state CTA", () => {
    it("shows a 'View Board' link in the empty state", () => {
      // The empty state block (when isEmpty is true) should contain a View Board link
      expect(boardSummarySrc).toMatch(/isEmpty[\s\S]*View Board/);
    });

    it("has an ArrowRightIcon in the empty state link", () => {
      expect(boardSummarySrc).toContain("ArrowRightIcon");
    });
  });

  // AC3: Empty state has brief copy explaining how tasks appear
  describe("Empty state copy", () => {
    it("includes copy about tasks appearing through actions or chat", () => {
      expect(boardSummarySrc).toMatch(
        /tasks.*will appear|appear.*when created/i,
      );
    });

    it("does not just say 'No active work' with no further context", () => {
      // The old copy was too terse — should have an explanation
      expect(boardSummarySrc).not.toMatch(
        /No active work<\/span>\s*<\/div>\s*<\/div>\s*\);/,
      );
    });
  });

  // AC4: Empty state is visible enough that a user scanning the dashboard would notice it
  describe("Empty state visibility", () => {
    it("renders a Board label in the empty state for context", () => {
      // Even when empty, the Board label should appear so users know it exists
      expect(boardSummarySrc).toMatch(/isEmpty[\s\S]*Board/);
    });

    it("uses the same justify-between layout as the populated state", () => {
      // The empty state should have a structured layout, not just a tiny muted line
      expect(boardSummarySrc).toMatch(
        /isEmpty[\s\S]*justify-between/,
      );
    });
  });
});
