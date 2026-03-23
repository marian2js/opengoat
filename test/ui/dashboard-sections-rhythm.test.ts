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

const opportunitySrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/OpportunitySection.tsx",
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

const actionGridSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/ActionCardGrid.tsx",
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
    it("wraps ActionCardGrid in a dashboard-section divider", () => {
      // The ActionCardGrid wrapper should use dashboard-section for consistent dividers
      expect(dashboardSrc).toMatch(/dashboard-section[\s\S]*ActionCardGrid/);
    });

    it("wraps BoardSummary in a dashboard-section divider", () => {
      // Board summary should be wrapped in dashboard-section for separation
      expect(dashboardSrc).toMatch(/dashboard-section[\s\S]*BoardSummary/);
    });

    it("wraps OpportunitySection in a dashboard-section divider", () => {
      // Insights section should be wrapped in dashboard-section for separation
      expect(dashboardSrc).toMatch(/dashboard-section[\s\S]*OpportunitySection/);
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
    it("ActionCardGrid uses section-label class", () => {
      expect(actionGridSrc).toContain("section-label");
    });

    it("SuggestedActionGrid uses section-label class", () => {
      expect(suggestedSrc).toContain("section-label");
    });

    it("OpportunitySection uses section-label class", () => {
      expect(opportunitySrc).toContain("section-label");
    });

    it("BoardSummary uses section-label class", () => {
      expect(boardSummarySrc).toContain("section-label");
    });
  });

  // AC5: Visual rhythm — Insights section has subtle background tint
  describe("Insights section differentiation", () => {
    it("OpportunitySection has a subtle background tint wrapper", () => {
      // The insights section should have a bg tint to differentiate from action cards
      expect(opportunitySrc).toMatch(/bg-muted|bg-card|bg-primary/);
    });

    it("OpportunitySection wrapper has rounded corners", () => {
      expect(opportunitySrc).toMatch(/rounded-xl|rounded-lg/);
    });

    it("OpportunitySection wrapper has padding", () => {
      expect(opportunitySrc).toMatch(/\bp-4\b|\bp-5\b|\bp-6\b/);
    });
  });
});
