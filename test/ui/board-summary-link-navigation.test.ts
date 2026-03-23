import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardSummarySrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/BoardSummary.tsx",
  ),
  "utf-8",
);

const dashboardWorkspaceSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/dashboard/components/DashboardWorkspace.tsx",
  ),
  "utf-8",
);

const appSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/app/App.tsx",
  ),
  "utf-8",
);

describe("View Board link navigation — Dashboard → Board", () => {
  // AC1 & AC4: The fix uses the same navigation mechanism as the sidebar Board link,
  // not just window.location.hash. A callback prop from App.tsx sets the hash,
  // which triggers the hashchange listener that drives view switching.
  it("BoardSummary accepts an onNavigateToBoard callback prop", () => {
    expect(boardSummarySrc).toContain("onNavigateToBoard");
  });

  it("BoardSummary calls onNavigateToBoard on click in both empty and populated states", () => {
    // Interface + empty state + populated state = 3+
    const matches = boardSummarySrc.match(/onNavigateToBoard/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("DashboardWorkspace accepts and passes onNavigateToBoard to BoardSummary", () => {
    expect(dashboardWorkspaceSrc).toContain("onNavigateToBoard");
  });

  it("App.tsx passes onNavigateToBoard to DashboardWorkspace", () => {
    expect(appSrc).toContain("onNavigateToBoard");
  });

  it("App.tsx navigation callback sets window.location.hash to #board", () => {
    expect(appSrc).toContain('#board');
  });

  // Both the empty state and the populated state must have navigation
  it("has onClick handler in the empty state View Board link", () => {
    const afterIsEmpty = boardSummarySrc.split(/if\s*\(isEmpty\)/)[1];
    expect(afterIsEmpty).toBeTruthy();
    const isEmptyBranch = afterIsEmpty.slice(0, afterIsEmpty.indexOf("const pills"));
    expect(isEmptyBranch).toContain("onNavigateToBoard");
    expect(isEmptyBranch).toContain("View Board");
  });

  it("has onClick handler in the populated state View Board link", () => {
    const afterPills = boardSummarySrc.split(/const pills/)[1];
    expect(afterPills).toBeTruthy();
    expect(afterPills).toContain("onNavigateToBoard");
    expect(afterPills).toContain("View Board");
  });

  // BoardSummary should not try to do its own hash navigation
  it("does not use window.location.hash directly in BoardSummary", () => {
    expect(boardSummarySrc).not.toContain("window.location.hash");
  });

  // Uses button instead of anchor with preventDefault (react-doctor best practice)
  it("uses button elements instead of anchor with preventDefault", () => {
    expect(boardSummarySrc).not.toContain("preventDefault");
    expect(boardSummarySrc).toContain('type="button"');
  });

  // Sidebar is not affected
  it("does not import or modify sidebar components", () => {
    expect(boardSummarySrc).not.toContain("SidebarMenu");
    expect(boardSummarySrc).not.toContain("AppSidebar");
  });
});
