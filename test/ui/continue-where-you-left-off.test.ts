import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Helpers ──
const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

const HOOK_PATH = "features/dashboard/hooks/useMeaningfulWork.ts";
const COMPONENT_PATH = "features/dashboard/components/ContinueWhereYouLeftOff.tsx";
const DASHBOARD_PATH = "features/dashboard/components/DashboardWorkspace.tsx";

// ═══════════════════════════════════════════════════════
// 1. useMeaningfulWork hook — structure
// ═══════════════════════════════════════════════════════

describe("useMeaningfulWork hook", () => {
  it("exists as a hook file", () => {
    expect(existsSync(resolve(desktopSrc, HOOK_PATH))).toBe(true);
  });

  it("exports useMeaningfulWork function", () => {
    const src = readFile(HOOK_PATH);
    expect(src).toContain("export function useMeaningfulWork");
  });

  it("returns items array and hasMeaningfulWork boolean", () => {
    const src = readFile(HOOK_PATH);
    expect(src).toContain("items");
    expect(src).toContain("hasMeaningfulWork");
    expect(src).toContain("isLoading");
  });

  it("defines MeaningfulWorkItem interface with required fields", () => {
    const src = readFile(HOOK_PATH);
    expect(src).toContain("MeaningfulWorkItem");
    expect(src).toContain("id:");
    expect(src).toContain('type:');
    expect(src).toContain("title:");
    expect(src).toContain("status:");
    expect(src).toContain("updatedAt:");
    expect(src).toContain("needsInput:");
  });
});

// ═══════════════════════════════════════════════════════
// 2. useMeaningfulWork — filtering logic
// ═══════════════════════════════════════════════════════

describe("useMeaningfulWork filtering", () => {
  it("filters out runs with startedFrom action (system-initiated)", () => {
    const src = readFile(HOOK_PATH);
    expect(src).toContain("startedFrom");
    // Should exclude "action" origin
    expect(src).toMatch(/action/);
  });

  it("includes runs with startedFrom dashboard and chat", () => {
    const src = readFile(HOOK_PATH);
    expect(src).toContain("dashboard");
    expect(src).toContain("chat");
  });

  it("filters out runs older than 48 hours", () => {
    const src = readFile(HOOK_PATH);
    // Should have a staleness threshold
    expect(src).toMatch(/48/);
  });

  it("excludes completed action session states (done, saved-to-board, ready-to-review)", () => {
    const src = readFile(HOOK_PATH);
    // Should only include active states
    expect(src).toContain("starting");
    expect(src).toContain("working");
    expect(src).toContain("needs-input");
  });

  it("caps output at 3 items maximum", () => {
    const src = readFile(HOOK_PATH);
    expect(src).toMatch(/\.slice\(0,\s*3\)/);
  });

  it("sorts needs-input items first (most actionable)", () => {
    const src = readFile(HOOK_PATH);
    expect(src).toContain("needsInput");
    // Should sort by needsInput priority
    expect(src).toContain("sort");
  });

  it("hasMeaningfulWork is true only when filtered items exist", () => {
    const src = readFile(HOOK_PATH);
    expect(src).toContain("hasMeaningfulWork");
    expect(src).toMatch(/items\.length\s*>\s*0/);
  });
});

// ═══════════════════════════════════════════════════════
// 3. ContinueWhereYouLeftOff component — structure
// ═══════════════════════════════════════════════════════

describe("ContinueWhereYouLeftOff component", () => {
  it("exists as a component file", () => {
    expect(existsSync(resolve(desktopSrc, COMPONENT_PATH))).toBe(true);
  });

  it("exports a named function", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("export function ContinueWhereYouLeftOff");
  });

  it("returns null when items is empty", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("return null");
  });

  it('uses "Continue where you left off" label text', () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toMatch(/continue where you left off/i);
  });

  it("does NOT use old operational language", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).not.toContain("Now working on");
    expect(src).not.toContain("Active work");
  });

  it("section label uses mono uppercase styling", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("section-label");
  });

  it("shows Continue CTA for items with sessionId", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("Continue");
    expect(src).toContain("onContinue");
  });

  it("uses compact layout (not prominent cards)", () => {
    const src = readFile(COMPONENT_PATH);
    // Should use a lighter border style, not full card
    expect(src).toContain("border-border/20");
  });

  it("shows status dot for each item", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("rounded-full");
  });

  it("uses amber color for needs-input items", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("amber");
  });

  it("shows timestamp for each item", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("updatedAt");
  });
});

// ═══════════════════════════════════════════════════════
// 4. DashboardWorkspace integration
// ═══════════════════════════════════════════════════════

describe("DashboardWorkspace integration with continue section", () => {
  it("imports ContinueWhereYouLeftOff (not NowWorkingOn or ActiveWorkSection)", () => {
    const src = readFile(DASHBOARD_PATH);
    expect(src).toContain("ContinueWhereYouLeftOff");
    expect(src).not.toContain("NowWorkingOn");
    expect(src).not.toContain("ActiveWorkSection");
  });

  it("imports useMeaningfulWork", () => {
    const src = readFile(DASHBOARD_PATH);
    expect(src).toContain("useMeaningfulWork");
  });

  it("uses meaningfulWork for maturity detection instead of raw hasActiveWork", () => {
    const src = readFile(DASHBOARD_PATH);
    expect(src).toContain("meaningfulWork");
    expect(src).toContain("useProjectMaturity");
  });

  it("renders ContinueWhereYouLeftOff component", () => {
    const src = readFile(DASHBOARD_PATH);
    expect(src).toContain("<ContinueWhereYouLeftOff");
  });

  it("does not import NowWorkingOn or NowWorkingOnSkeleton", () => {
    const src = readFile(DASHBOARD_PATH);
    expect(src).not.toMatch(/import.*NowWorkingOn/);
    expect(src).not.toMatch(/import.*NowWorkingOnSkeleton/);
  });
});

// ═══════════════════════════════════════════════════════
// 5. Old components are deleted
// ═══════════════════════════════════════════════════════

describe("Old components removed", () => {
  it("NowWorkingOn.tsx is deleted", () => {
    expect(existsSync(resolve(desktopSrc, "features/dashboard/components/NowWorkingOn.tsx"))).toBe(false);
  });

  it("ActiveWorkSection.tsx is deleted", () => {
    expect(existsSync(resolve(desktopSrc, "features/dashboard/components/ActiveWorkSection.tsx"))).toBe(false);
  });
});
