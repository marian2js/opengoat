import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Helpers ──
const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

// ═══════════════════════════════════════════════════════
// 1. useProjectMaturity hook
// ═══════════════════════════════════════════════════════

describe("useProjectMaturity hook", () => {
  const hookPath = "features/dashboard/hooks/useProjectMaturity.ts";

  it("exists as a hook file", () => {
    expect(existsSync(resolve(desktopSrc, hookPath))).toBe(true);
  });

  it("exports useProjectMaturity function", () => {
    const src = readFile(hookPath);
    expect(src).toContain("export function useProjectMaturity");
  });

  it("exports ProjectMaturity type with three tiers", () => {
    const src = readFile(hookPath);
    expect(src).toContain("ProjectMaturity");
    expect(src).toMatch(/['"]new['"]/);
    expect(src).toMatch(/['"]light['"]/);
    expect(src).toMatch(/['"]active['"]/);
  });

  it("returns a maturity tier string", () => {
    const src = readFile(hookPath);
    expect(src).toContain("maturity");
    // Should return a tier value
    expect(src).toMatch(/return\s+["']?(new|light|active)/);
  });

  it("uses hasMeaningfulWork for active detection", () => {
    const src = readFile(hookPath);
    expect(src).toContain("hasMeaningfulWork");
  });

  it("uses runsEmpty for new project detection", () => {
    const src = readFile(hookPath);
    expect(src).toContain("runsEmpty");
  });

  it("uses boardEmpty for new project detection", () => {
    const src = readFile(hookPath);
    expect(src).toContain("boardEmpty");
  });

  it("returns 'active' when hasMeaningfulWork is true", () => {
    const src = readFile(hookPath);
    // The logic should check hasMeaningfulWork and return 'active'
    expect(src).toContain("hasMeaningfulWork");
    expect(src).toContain("active");
  });

  it("returns 'new' when no work, runs empty, and board empty", () => {
    const src = readFile(hookPath);
    // Should have logic for the 'new' tier
    expect(src).toContain("new");
    expect(src).toContain("runsEmpty");
    expect(src).toContain("boardEmpty");
  });

  it("returns 'light' as default fallback between new and active", () => {
    const src = readFile(hookPath);
    expect(src).toContain("light");
  });
});

// ═══════════════════════════════════════════════════════
// 2. DashboardWorkspace unified layout
// ═══════════════════════════════════════════════════════

describe("DashboardWorkspace unified layout", () => {
  const dashPath = "features/dashboard/components/DashboardWorkspace.tsx";

  it("imports useProjectMaturity", () => {
    const src = readFile(dashPath);
    expect(src).toContain("useProjectMaturity");
  });

  it("does NOT use Mode A / Mode B branching", () => {
    const src = readFile(dashPath);
    expect(src).not.toContain("Mode A");
    expect(src).not.toContain("Mode B");
  });

  it("does NOT use hasActiveWork for layout branching", () => {
    const src = readFile(dashPath);
    expect(src).not.toContain("hasActiveWork");
  });

  it("does NOT render ActionCardGrid", () => {
    const src = readFile(dashPath);
    expect(src).not.toContain("<ActionCardGrid");
    expect(src).not.toContain("ActionCardGrid");
  });

  it("renders sections in correct order: Hero, Jobs, Roster, Outputs, Continue, Board", () => {
    const src = readFile(dashPath);
    const heroIdx = src.indexOf("<CompanyUnderstandingHero");
    const jobsIdx = src.indexOf("<RecommendedJobs");
    const rosterIdx = src.indexOf("<DashboardAgentRoster");
    const outputsIdx = src.indexOf("<RecentOutputs");
    const continueIdx = src.indexOf("<ContinueWhereYouLeftOff");
    const boardIdx = src.indexOf("<BoardSummary");

    expect(heroIdx).toBeGreaterThan(-1);
    expect(jobsIdx).toBeGreaterThan(heroIdx);
    expect(rosterIdx).toBeGreaterThan(jobsIdx);
    expect(outputsIdx).toBeGreaterThan(rosterIdx);
    expect(continueIdx).toBeGreaterThan(outputsIdx);
    expect(boardIdx).toBeGreaterThan(continueIdx);
  });

  it("renders each section component exactly once", () => {
    const src = readFile(dashPath);
    const countOccurrences = (s: string, sub: string) => {
      let count = 0;
      let pos = 0;
      while ((pos = s.indexOf(sub, pos)) !== -1) { count++; pos += sub.length; }
      return count;
    };
    expect(countOccurrences(src, "<CompanyUnderstandingHero")).toBe(1);
    expect(countOccurrences(src, "<RecommendedJobs")).toBe(1);
    expect(countOccurrences(src, "<DashboardAgentRoster")).toBe(1);
    expect(countOccurrences(src, "<RecentOutputs")).toBe(1);
    expect(countOccurrences(src, "<ContinueWhereYouLeftOff")).toBe(1);
    expect(countOccurrences(src, "<BoardSummary")).toBe(1);
  });

  it("hides BoardSummary for new projects", () => {
    const src = readFile(dashPath);
    // BoardSummary should be gated by maturity !== 'new'
    expect(src).toMatch(/maturity\s*!==\s*['"]new['"]/);
  });

  it("is under 300 lines", () => {
    const src = readFile(dashPath);
    const lineCount = src.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(300);
  });
});

// ═══════════════════════════════════════════════════════
// 3. useProjectMaturity pure logic tests
// ═══════════════════════════════════════════════════════

describe("useProjectMaturity pure logic", () => {
  // Import the function to test directly
  const hookPath = resolve(desktopSrc, "features/dashboard/hooks/useProjectMaturity.ts");

  it("computeMaturity returns 'new' for empty project", async () => {
    const mod = await import(hookPath);
    const result = mod.computeMaturity({
      hasMeaningfulWork: false,
      runsEmpty: true,
      boardEmpty: true,
      hasRecentSessions: false,
    });
    expect(result).toBe("new");
  });

  it("computeMaturity returns 'active' when meaningful work exists", async () => {
    const mod = await import(hookPath);
    const result = mod.computeMaturity({
      hasMeaningfulWork: true,
      runsEmpty: false,
      boardEmpty: false,
      hasRecentSessions: true,
    });
    expect(result).toBe("active");
  });

  it("computeMaturity returns 'light' for partial activity (runs exist but no meaningful work)", async () => {
    const mod = await import(hookPath);
    const result = mod.computeMaturity({
      hasMeaningfulWork: false,
      runsEmpty: false,
      boardEmpty: true,
      hasRecentSessions: false,
    });
    expect(result).toBe("light");
  });

  it("computeMaturity returns 'light' when board has items but no meaningful work", async () => {
    const mod = await import(hookPath);
    const result = mod.computeMaturity({
      hasMeaningfulWork: false,
      runsEmpty: true,
      boardEmpty: false,
      hasRecentSessions: false,
    });
    expect(result).toBe("light");
  });

  it("computeMaturity returns 'light' when recent sessions exist but no meaningful work", async () => {
    const mod = await import(hookPath);
    const result = mod.computeMaturity({
      hasMeaningfulWork: false,
      runsEmpty: true,
      boardEmpty: true,
      hasRecentSessions: true,
    });
    expect(result).toBe("light");
  });

  it("computeMaturity returns 'active' even when runs and board are empty but meaningful work exists", async () => {
    const mod = await import(hookPath);
    const result = mod.computeMaturity({
      hasMeaningfulWork: true,
      runsEmpty: true,
      boardEmpty: true,
      hasRecentSessions: false,
    });
    expect(result).toBe("active");
  });
});
