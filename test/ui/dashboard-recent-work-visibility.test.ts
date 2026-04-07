import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

// ═══════════════════════════════════════════════════════
// 1. ContinueWhereYouLeftOff renders in both Mode A and Mode B
// ═══════════════════════════════════════════════════════

describe("ContinueWhereYouLeftOff renders in unified layout", () => {
  it("ContinueWhereYouLeftOff appears in the unified layout", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    const matches = src.match(/<ContinueWhereYouLeftOff/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it("ContinueWhereYouLeftOff hides when items are empty (returns null)", () => {
    const src = readFile("features/dashboard/components/ContinueWhereYouLeftOff.tsx");
    expect(src).toContain("items.length === 0");
    expect(src).toMatch(/return\s+null/);
  });
});

// ═══════════════════════════════════════════════════════
// 2. Mode detection uses useMeaningfulWork
// ═══════════════════════════════════════════════════════

describe("Maturity detection uses meaningful work filtering", () => {
  it("uses useMeaningfulWork hook", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("useMeaningfulWork");
  });

  it("uses useProjectMaturity for layout decisions", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("useProjectMaturity");
    expect(src).toContain("maturity");
  });

  it("does not use raw activeObjective or raw runs for mode detection", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).not.toContain("activeObjective.objective !== null");
    expect(src).not.toContain("runsResult.runs.length > 0");
  });
});

// ═══════════════════════════════════════════════════════
// 3. Dashboard layout order: Company → Mode split (with ContinueWhereYouLeftOff inside)
// ═══════════════════════════════════════════════════════

describe("Dashboard layout order", () => {
  it("renders CompanyUnderstandingHero before other sections in unified layout", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    const heroPos = src.indexOf("<CompanyUnderstandingHero");
    const continuePos = src.indexOf("<ContinueWhereYouLeftOff");

    expect(heroPos).toBeGreaterThan(-1);
    expect(continuePos).toBeGreaterThan(-1);
    expect(heroPos).toBeLessThan(continuePos);
  });
});

// ═══════════════════════════════════════════════════════
// 4. useActionSessions hook refreshes on navigation
// ═══════════════════════════════════════════════════════

describe("useActionSessions refreshes on navigation", () => {
  it("listens for hashchange events", () => {
    const src = readFile("features/dashboard/hooks/useActionSessions.ts");
    expect(src).toContain("hashchange");
  });

  it("listens for focus events", () => {
    const src = readFile("features/dashboard/hooks/useActionSessions.ts");
    expect(src).toContain("focus");
  });

  it("listens for storage events for cross-tab sync", () => {
    const src = readFile("features/dashboard/hooks/useActionSessions.ts");
    expect(src).toContain("storage");
  });
});

// ═══════════════════════════════════════════════════════
// 5. Session metadata always written on creation paths
// ═══════════════════════════════════════════════════════

describe("Session metadata written on all creation paths", () => {
  it("handleActionClick writes action session metadata", () => {
    const src = readFile("app/App.tsx");
    expect(src).toContain("setActionSessionMeta");
  });

  it("ActionSessionView initializes metadata if missing", () => {
    const src = readFile("features/action-session/components/ActionSessionView.tsx");
    expect(src).toContain("setActionSessionMeta");
    expect(src).toContain("!existing");
  });
});
