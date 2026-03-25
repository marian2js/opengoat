import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

// ═══════════════════════════════════════════════════════
// 1. ActiveWorkSection renders outside Mode A/B split
// ═══════════════════════════════════════════════════════

describe("ActiveWorkSection renders independently of Mode A/B", () => {
  it("ActiveWorkSection appears before the Mode A/B conditional", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    // ActiveWorkSection should be rendered BEFORE the hasActiveWork ternary
    const activeWorkPos = src.indexOf("<ActiveWorkSection");
    const modeConditionalPos = src.indexOf("{hasActiveWork ?");
    expect(activeWorkPos).toBeGreaterThan(-1);
    expect(modeConditionalPos).toBeGreaterThan(-1);
    expect(activeWorkPos).toBeLessThan(modeConditionalPos);
  });

  it("ActiveWorkSection is not inside the Mode B branch", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    // The Mode B branch starts with the hasActiveWork ternary
    const modeBStart = src.indexOf("{hasActiveWork ?");
    const modeBEnd = src.indexOf("Mode A", modeBStart);
    if (modeBStart > -1 && modeBEnd > -1) {
      const modeBContent = src.slice(modeBStart, modeBEnd);
      expect(modeBContent).not.toContain("<ActiveWorkSection");
    }
  });

  it("ActiveWorkSection is not wrapped in actionSessions.hasActiveWork guard", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    // Should not have the double-gate pattern
    expect(src).not.toContain("actionSessions.hasActiveWork && (");
  });
});

// ═══════════════════════════════════════════════════════
// 2. ActiveWorkSection handles its own visibility
// ═══════════════════════════════════════════════════════

describe("ActiveWorkSection self-manages visibility", () => {
  it("returns null when no sessions exist", () => {
    const src = readFile("features/dashboard/components/ActiveWorkSection.tsx");
    expect(src).toContain("return null");
  });

  it("uses useActionSessions for data", () => {
    const src = readFile("features/dashboard/components/ActiveWorkSection.tsx");
    expect(src).toContain("useActionSessions");
  });

  it("checks hasActiveWork before rendering", () => {
    const src = readFile("features/dashboard/components/ActiveWorkSection.tsx");
    expect(src).toContain("hasActiveWork");
  });
});

// ═══════════════════════════════════════════════════════
// 3. Dashboard layout order: Company → FreeText → ActiveWork → Mode split
// ═══════════════════════════════════════════════════════

describe("Dashboard layout order", () => {
  it("renders CompanySummary, FreeTextInput, ActiveWorkSection in order before mode split", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    const companySummaryPos = src.indexOf("<CompanySummary");
    const freeTextPos = src.indexOf("<FreeTextInput");
    const activeWorkPos = src.indexOf("<ActiveWorkSection");
    const modeSplitPos = src.indexOf("{hasActiveWork ?");

    expect(companySummaryPos).toBeGreaterThan(-1);
    expect(freeTextPos).toBeGreaterThan(-1);
    expect(activeWorkPos).toBeGreaterThan(-1);
    expect(modeSplitPos).toBeGreaterThan(-1);

    expect(companySummaryPos).toBeLessThan(freeTextPos);
    expect(freeTextPos).toBeLessThan(activeWorkPos);
    expect(activeWorkPos).toBeLessThan(modeSplitPos);
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
