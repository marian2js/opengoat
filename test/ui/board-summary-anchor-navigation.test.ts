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

describe("View Board anchor navigation — Dashboard → Board", () => {
  // AC1: Clicking "View Board" navigates to Board page via native hash link
  it("uses anchor elements with href='#board' instead of button elements", () => {
    expect(boardSummarySrc).toContain('href="#board"');
    expect(boardSummarySrc).not.toContain('type="button"');
  });

  // AC2: Both empty state and populated state have anchor navigation
  it("has anchor link in the empty state View Board", () => {
    const afterIsEmpty = boardSummarySrc.split(/if\s*\(isEmpty\)/)[1];
    expect(afterIsEmpty).toBeTruthy();
    const isEmptyBranch = afterIsEmpty.slice(0, afterIsEmpty.indexOf("const pills"));
    expect(isEmptyBranch).toContain('href="#board"');
    expect(isEmptyBranch).toContain("View Board");
  });

  it("has anchor link in the populated state View Board", () => {
    const afterPills = boardSummarySrc.split(/const pills/)[1];
    expect(afterPills).toBeTruthy();
    expect(afterPills).toContain('href="#board"');
    expect(afterPills).toContain("View Board");
  });

  // The component should not rely on onClick callback for navigation
  it("does not use onClick handler for View Board navigation", () => {
    expect(boardSummarySrc).not.toContain("onNavigateToBoard");
    expect(boardSummarySrc).not.toContain("onClick={onNavigateToBoard}");
  });

  // AC5: Sidebar is not affected
  it("does not import or modify sidebar components", () => {
    expect(boardSummarySrc).not.toContain("SidebarMenu");
    expect(boardSummarySrc).not.toContain("AppSidebar");
  });

  // Uses native <a> tags for the View Board links
  it("renders exactly two anchor elements for View Board", () => {
    const anchorMatches = boardSummarySrc.match(/<a\s/g);
    expect(anchorMatches).not.toBeNull();
    expect(anchorMatches!.length).toBe(2);
  });
});
