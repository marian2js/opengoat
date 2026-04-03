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
  // AC1: Clicking "View" navigates to Board page via native hash link
  it("uses anchor elements with href='#board' instead of button elements", () => {
    expect(boardSummarySrc).toContain('href="#board"');
    expect(boardSummarySrc).not.toContain('type="button"');
  });

  // AC2: Empty state returns null (hidden per spec — no empty sections)
  it("returns null when empty instead of showing a placeholder", () => {
    const afterIsEmpty = boardSummarySrc.split(/if\s*\(isEmpty\)/)[1];
    expect(afterIsEmpty).toBeTruthy();
    // Should return null immediately
    expect(afterIsEmpty.trimStart().startsWith("{")).toBe(true);
    expect(afterIsEmpty).toContain("return null");
  });

  it("has anchor link in the populated state", () => {
    const afterTotal = boardSummarySrc.split(/const total/)[1];
    expect(afterTotal).toBeTruthy();
    expect(afterTotal).toContain('href="#board"');
    expect(afterTotal).toContain("View");
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

  // Uses native <a> tag for the View link (compact: no active objective link)
  it("renders an anchor element for View link", () => {
    const anchorMatches = boardSummarySrc.match(/<a\s/g);
    expect(anchorMatches).not.toBeNull();
    expect(anchorMatches!.length).toBe(1);
  });
});
