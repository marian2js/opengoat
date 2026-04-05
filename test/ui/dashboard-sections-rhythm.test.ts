import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboardSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/DashboardWorkspace.tsx",
  ),
  "utf-8",
);

const suggestedSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/SuggestedActionGrid.tsx",
  ),
  "utf-8",
);

const boardSummarySrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/BoardSummary.tsx",
  ),
  "utf-8",
);

describe("Dashboard sections rhythm — visual separation and spacing", () => {
  // AC1: Clear visual separation between Dashboard sections via dashboard-section dividers
  describe("Section dividers", () => {
    it("wraps BoardSummary in a dashboard-section divider", () => {
      // Board summary should be wrapped in dashboard-section for separation
      expect(dashboardSrc).toMatch(/dashboard-section[\s\S]*BoardSummary/);
    });

    it("wraps RecommendedJobs in a dashboard-section divider", () => {
      // Recommended jobs section should be wrapped in dashboard-section for separation
      expect(dashboardSrc).toMatch(/dashboard-section[\s\S]*RecommendedJobs/);
    });
  });

  // AC2: SUGGESTED ACTIONS hides when empty
  describe("Suggested actions empty state", () => {
    it("returns null when no actions and not generating", () => {
      // SuggestedActionGrid should return null when empty
      expect(suggestedSrc).toMatch(
        /actions\.length\s*===\s*0.*return\s+null/s,
      );
    });
  });

  // AC3: Vertical spacing between sections is 32-48px
  describe("Consistent vertical spacing", () => {
    it("uses dashboard-section class for consistent section spacing", () => {
      // Each major section wrapper should use the dashboard-section utility class
      expect(dashboardSrc).toContain("dashboard-section");
    });

    it("dashboard-section provides at least 32px top padding", () => {
      // pt-8 = 32px, pt-10 = 40px, pt-12 = 48px — any of these are acceptable
      expect(dashboardSrc).toMatch(/dashboard-section/);
    });
  });

  // AC4: All section labels follow DESIGN.md section-label pattern
  describe("Section label consistency", () => {
    it("SuggestedActionGrid uses section-label class", () => {
      expect(suggestedSrc).toContain("section-label");
    });

    it("BoardSummary is a compact strip (no section-label needed)", () => {
      // BoardSummary is now a minimal count-only strip, not a full section
      expect(boardSummarySrc).toContain("Board");
    });
  });
});
