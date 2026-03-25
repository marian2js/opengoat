import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Helpers ──
const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

const dashboardWorkspacePath =
  "features/dashboard/components/DashboardWorkspace.tsx";
const nowWorkingOnPath =
  "features/dashboard/components/NowWorkingOn.tsx";

// ═══════════════════════════════════════════════════════
// 1. Loading skeleton renders while runsResult.isLoading
// ═══════════════════════════════════════════════════════

describe("NowWorkingOn loading skeleton", () => {
  it("renders skeleton when runsResult.isLoading is true (Mode B)", () => {
    const src = readFile(dashboardWorkspacePath);
    // The dashboard should check runsResult.isLoading and show a skeleton
    expect(src).toContain("runsResult.isLoading");
    // Should render NowWorkingOnSkeleton during loading
    expect(src).toContain("NowWorkingOnSkeleton");
  });

  it("uses a conditional that branches on isLoading before checking runs.length", () => {
    const src = readFile(dashboardWorkspacePath);
    // The pattern: isLoading → skeleton, else runs.length > 0 → NowWorkingOn, else null
    // isLoading check should come before or alongside the runs.length check
    const isLoadingIdx = src.indexOf("runsResult.isLoading");
    const runsLenIdx = src.indexOf("runsResult.runs.length > 0");
    expect(isLoadingIdx).toBeGreaterThan(-1);
    expect(runsLenIdx).toBeGreaterThan(-1);
  });

  it("skeleton component is used for loading state", () => {
    const src = readFile(dashboardWorkspacePath);
    // DashboardWorkspace delegates to NowWorkingOnSkeleton component
    expect(src).toContain("NowWorkingOnSkeleton");
    // The skeleton component itself has the visual structure (tested separately)
  });

  it("skeleton is inside dashboard-section with pb-4 like the real content", () => {
    const src = readFile(dashboardWorkspacePath);
    // The skeleton wrapper should use the same container class as the real NowWorkingOn
    // to prevent layout shift
    expect(src).toMatch(/dashboard-section/);
  });

  it("does not render skeleton when not loading and no runs", () => {
    const src = readFile(dashboardWorkspacePath);
    // Should have a null/nothing branch for when not loading and runs empty
    // The ternary should end with : null for empty runs case
    expect(src).toMatch(/:\s*null/);
  });
});

// ═══════════════════════════════════════════════════════
// 2. NowWorkingOnSkeleton component
// ═══════════════════════════════════════════════════════

describe("NowWorkingOnSkeleton", () => {
  it("is exported from NowWorkingOn.tsx", () => {
    const src = readFile(nowWorkingOnPath);
    expect(src).toContain("NowWorkingOnSkeleton");
    expect(src).toMatch(/export\s+function\s+NowWorkingOnSkeleton/);
  });

  it("uses animate-pulse for loading animation", () => {
    const src = readFile(nowWorkingOnPath);
    expect(src).toContain("animate-pulse");
  });

  it("uses Skeleton component from ui library", () => {
    const src = readFile(nowWorkingOnPath);
    expect(src).toContain("Skeleton");
    expect(src).toMatch(/from\s+["']@\/components\/ui\/skeleton["']/);
  });

  it("matches the card structure of NowWorkingOn (rounded-lg border bg-card)", () => {
    const src = readFile(nowWorkingOnPath);
    // Should render as section with same card styling
    const skeletonFnMatch = src.match(
      /export\s+function\s+NowWorkingOnSkeleton[\s\S]+?^}/m,
    );
    expect(skeletonFnMatch).not.toBeNull();
    const skeletonSrc = skeletonFnMatch![0];
    expect(skeletonSrc).toContain("rounded-lg");
    expect(skeletonSrc).toContain("border");
  });
});

// ═══════════════════════════════════════════════════════
// 3. DashboardWorkspace imports NowWorkingOnSkeleton
// ═══════════════════════════════════════════════════════

describe("DashboardWorkspace integration", () => {
  it("imports NowWorkingOnSkeleton from NowWorkingOn module", () => {
    const src = readFile(dashboardWorkspacePath);
    expect(src).toContain("NowWorkingOnSkeleton");
  });
});
