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

describe("View Board link navigation — Dashboard → Board", () => {
  // AC1: View Board uses native anchor navigation with href="#board"
  it("BoardSummary uses anchor elements with href='#board' for navigation", () => {
    expect(boardSummarySrc).toContain('href="#board"');
  });

  // Empty state returns null — hidden per spec (no empty sections)
  it("returns null for empty state instead of showing placeholder", () => {
    const afterIsEmpty = boardSummarySrc.split(/if\s*\(isEmpty\)/)[1];
    expect(afterIsEmpty).toBeTruthy();
    expect(afterIsEmpty).toContain("return null");
  });

  it("has anchor link in the populated state", () => {
    const afterTotal = boardSummarySrc.split(/const total/)[1];
    expect(afterTotal).toBeTruthy();
    expect(afterTotal).toContain('href="#board"');
    expect(afterTotal).toContain("View");
  });

  // Does not use window.location.hash directly
  it("does not use window.location.hash directly in BoardSummary", () => {
    expect(boardSummarySrc).not.toContain("window.location.hash");
  });

  // Sidebar is not affected
  it("does not import or modify sidebar components", () => {
    expect(boardSummarySrc).not.toContain("SidebarMenu");
    expect(boardSummarySrc).not.toContain("AppSidebar");
  });
});
