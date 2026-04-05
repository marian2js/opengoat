import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Helpers ──
const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

const dashboardWorkspacePath =
  "features/dashboard/components/DashboardWorkspace.tsx";

// ═══════════════════════════════════════════════════════
// NowWorkingOn was replaced by ContinueWhereYouLeftOff
// ═══════════════════════════════════════════════════════

describe("ContinueWhereYouLeftOff replaces NowWorkingOn", () => {
  it("DashboardWorkspace no longer imports NowWorkingOn", () => {
    const src = readFile(dashboardWorkspacePath);
    expect(src).not.toContain("NowWorkingOn");
    expect(src).not.toContain("NowWorkingOnSkeleton");
  });

  it("DashboardWorkspace imports ContinueWhereYouLeftOff instead", () => {
    const src = readFile(dashboardWorkspacePath);
    expect(src).toContain("ContinueWhereYouLeftOff");
  });

  it("uses useMeaningfulWork for filtered work items", () => {
    const src = readFile(dashboardWorkspacePath);
    expect(src).toContain("useMeaningfulWork");
    expect(src).toContain("meaningfulWork");
  });
});
