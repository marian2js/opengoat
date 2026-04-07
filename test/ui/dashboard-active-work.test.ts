import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Helpers ──
const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

// ═════════���══════════════════════════���══════════════════
// 1. getAllActionSessionMetas — data layer
// ═════════��════════════��══════════════════════════════���═

describe("getAllActionSessionMetas", () => {
  it("is exported from action-session-state.ts", () => {
    const src = readFile("features/action-session/lib/action-session-state.ts");
    expect(src).toContain("export function getAllActionSessionMetas");
  });

  it("returns a MetaStore record", () => {
    const src = readFile("features/action-session/lib/action-session-state.ts");
    expect(src).toContain("getAllActionSessionMetas");
    expect(src).toContain("MetaStore");
  });
});

// ══���═══��════════════════════════════════════════════════
// 2. useActionSessions hook
// ══════════════════════���═════════════════════════════��══

describe("useActionSessions hook", () => {
  const hookPath = "features/dashboard/hooks/useActionSessions.ts";

  it("exists as a hook file", () => {
    expect(existsSync(resolve(desktopSrc, hookPath))).toBe(true);
  });

  it("imports getAllActionSessionMetas", () => {
    const src = readFile(hookPath);
    expect(src).toContain("getAllActionSessionMetas");
  });

  it("exports useActionSessions function", () => {
    const src = readFile(hookPath);
    expect(src).toContain("export function useActionSessions");
  });

  it("returns activeSessions and recentSessions", () => {
    const src = readFile(hookPath);
    expect(src).toContain("activeSessions");
    expect(src).toContain("recentSessions");
  });

  it("returns hasActiveWork boolean", () => {
    const src = readFile(hookPath);
    expect(src).toContain("hasActiveWork");
  });

  it("sorts sessions by startedAt descending", () => {
    const src = readFile(hookPath);
    expect(src).toContain("startedAt");
    expect(src).toContain("sort");
  });
});

// ═════════════════════════���═════════════════════════════
// 3. ContinueWhereYouLeftOff replaces ActiveWorkSection
// ═════════════════════════════════════════���═════════════

describe("ContinueWhereYouLeftOff component", () => {
  const componentPath = "features/dashboard/components/ContinueWhereYouLeftOff.tsx";

  it("exists as a component file", () => {
    expect(existsSync(resolve(desktopSrc, componentPath))).toBe(true);
  });

  it('uses "Continue where you left off" label', () => {
    const src = readFile(componentPath);
    expect(src).toMatch(/continue where you left off/i);
  });

  it("has continue action for items", () => {
    const src = readFile(componentPath);
    expect(src).toContain("Continue");
    expect(src).toContain("onContinue");
  });

  it("hides when no items (returns null)", () => {
    const src = readFile(componentPath);
    expect(src).toContain("items.length === 0");
    expect(src).toMatch(/return\s+null/);
  });

  it("uses section-label styling for heading", () => {
    const src = readFile(componentPath);
    expect(src).toContain("section-label");
  });
});

// ��═══════════��═══════════════════════════════════��══════
// 4. DashboardWorkspace integration
// ═══��═══════════════════════════════════════════════════

describe("DashboardWorkspace active work integration", () => {
  it("imports ContinueWhereYouLeftOff", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("ContinueWhereYouLeftOff");
  });

  it("renders ContinueWhereYouLeftOff in dashboard", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("<ContinueWhereYouLeftOff");
  });

  it("uses useMeaningfulWork for mode detection", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("useMeaningfulWork");
    expect(src).toContain("meaningfulWork");
  });

  it("passes onContinue to ContinueWhereYouLeftOff", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("onContinue");
  });
});

// ═══��═══════════════════════════════���═══════════════════
// 5. Mode A stays clean — no continue section when no meaningful work
// ═════════════════════��═══════════════════════���═════════

describe("Mode A stays clean", () => {
  it("ContinueWhereYouLeftOff hides when items is empty (returns null)", () => {
    const src = readFile("features/dashboard/components/ContinueWhereYouLeftOff.tsx");
    expect(src).toContain("items.length === 0");
    expect(src).toMatch(/return\s+null/);
  });
});
