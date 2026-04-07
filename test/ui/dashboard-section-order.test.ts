import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

// ═══════════════════════════════════════════════════════
// 1. Complete section order — all 7 sections
// ═══════════════════════════════════════════════════════

describe("Dashboard section order — all 7 sections", () => {
  const dashSrc = () => readFile("features/dashboard/components/DashboardWorkspace.tsx");

  it("renders all 7 sections in correct order: Hero, Jobs, Input, Roster, Outputs, Continue, Board", () => {
    const src = dashSrc();
    const heroIdx = src.indexOf("<CompanyUnderstandingHero");
    const jobsIdx = src.indexOf("<RecommendedJobs");
    const inputIdx = src.indexOf("<JobOrientedInput");
    const rosterIdx = src.indexOf("<DashboardAgentRoster");
    const outputsIdx = src.indexOf("<RecentOutputs");
    const continueIdx = src.indexOf("<ContinueWhereYouLeftOff");
    const boardIdx = src.indexOf("<BoardSummary");

    // All 7 must exist
    expect(heroIdx).toBeGreaterThan(-1);
    expect(jobsIdx).toBeGreaterThan(-1);
    expect(inputIdx).toBeGreaterThan(-1);
    expect(rosterIdx).toBeGreaterThan(-1);
    expect(outputsIdx).toBeGreaterThan(-1);
    expect(continueIdx).toBeGreaterThan(-1);
    expect(boardIdx).toBeGreaterThan(-1);

    // Correct order: 1 < 2 < 3 < 4 < 5 < 6 < 7
    expect(heroIdx).toBeLessThan(jobsIdx);
    expect(jobsIdx).toBeLessThan(inputIdx);
    expect(inputIdx).toBeLessThan(rosterIdx);
    expect(rosterIdx).toBeLessThan(outputsIdx);
    expect(outputsIdx).toBeLessThan(continueIdx);
    expect(continueIdx).toBeLessThan(boardIdx);
  });

  it("JobOrientedInput appears between RecommendedJobs and DashboardAgentRoster", () => {
    const src = dashSrc();
    const jobsIdx = src.indexOf("<RecommendedJobs");
    const inputIdx = src.indexOf("<JobOrientedInput");
    const rosterIdx = src.indexOf("<DashboardAgentRoster");

    expect(inputIdx).toBeGreaterThan(jobsIdx);
    expect(inputIdx).toBeLessThan(rosterIdx);
  });
});

// ═══════════════════════════════════════════════════════
// 2. ContinueWhereYouLeftOff receives maturity prop
// ═══════════════════════════════════════════════════════

describe("ContinueWhereYouLeftOff maturity-aware demotion", () => {
  const dashSrc = () => readFile("features/dashboard/components/DashboardWorkspace.tsx");
  const continueSrc = () => readFile("features/dashboard/components/ContinueWhereYouLeftOff.tsx");

  it("DashboardWorkspace passes maturity prop to ContinueWhereYouLeftOff", () => {
    const src = dashSrc();
    // The JSX should pass maturity={maturity} or maturity=
    expect(src).toMatch(/<ContinueWhereYouLeftOff[\s\S]*?maturity[=]/);
  });

  it("ContinueWhereYouLeftOff accepts a maturity prop", () => {
    const src = continueSrc();
    expect(src).toContain("maturity");
  });

  it("ContinueWhereYouLeftOff hides empty state for non-active maturity", () => {
    const src = continueSrc();
    // Should return null when items are empty and maturity is not active
    expect(src).toMatch(/items\.length\s*===\s*0/);
    expect(src).toMatch(/return\s+null/);
  });

  it("ContinueWhereYouLeftOff uses neutral (non-primary) border styling", () => {
    const src = continueSrc();
    // Populated state should NOT use primary-color border — should be neutral
    expect(src).not.toMatch(/border-primary\/10/);
  });

  it("ContinueWhereYouLeftOff hover uses neutral colors, not primary", () => {
    const src = continueSrc();
    // Hover on items should be neutral, not primary-tinted
    expect(src).not.toMatch(/hover:bg-primary/);
  });
});

// ═══════════════════════════════════════════════════════
// 3. BoardSummary demotion verification
// ═══════════════════════════════════════════════════════

describe("BoardSummary demotion", () => {
  const dashSrc = () => readFile("features/dashboard/components/DashboardWorkspace.tsx");
  const boardSrc = () => readFile("features/dashboard/components/BoardSummary.tsx");

  it("BoardSummary is gated by maturity !== 'new'", () => {
    const src = dashSrc();
    expect(src).toMatch(/maturity\s*!==\s*['"]new['"]/);
  });

  it("BoardSummary uses neutral border, not accent/primary", () => {
    const src = boardSrc();
    // Should use neutral border colors
    expect(src).toMatch(/border-border|border-white/);
    // Should NOT use primary-colored borders on the outer container
    expect(src).not.toMatch(/border-primary/);
  });

  it("BoardSummary returns null when empty", () => {
    const src = boardSrc();
    expect(src).toMatch(/isEmpty[\s\S]*?return\s+null/);
  });
});

// ═══════════════════════════════════════════════════════
// 4. Action-first layout: jobs/outputs visually heavier than continue/board
// ═══════════════════════════════════════════════════════

describe("Action-first layout hierarchy", () => {
  const dashSrc = () => readFile("features/dashboard/components/DashboardWorkspace.tsx");

  it("RecommendedJobs is wrapped in dashboard-section", () => {
    const src = dashSrc();
    expect(src).toMatch(/dashboard-section[\s\S]*?<RecommendedJobs/);
  });

  it("JobOrientedInput is wrapped in dashboard-section", () => {
    const src = dashSrc();
    expect(src).toMatch(/dashboard-section[\s\S]*?<JobOrientedInput/);
  });

  it("DashboardAgentRoster is wrapped in dashboard-section", () => {
    const src = dashSrc();
    expect(src).toMatch(/dashboard-section[\s\S]*?<DashboardAgentRoster/);
  });

  it("BoardSummary is wrapped in dashboard-section", () => {
    const src = dashSrc();
    expect(src).toMatch(/dashboard-section[\s\S]*?<BoardSummary/);
  });
});
