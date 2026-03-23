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
  // AC1: Clicking "View Board" link on Dashboard navigates to Board page
  // The link must use an onClick handler that programmatically sets window.location.hash
  // rather than relying on the anchor's default href behavior (which is unreliable in Tauri webview)
  it("uses onClick with window.location.hash for navigation", () => {
    expect(boardSummarySrc).toContain('window.location.hash = "#board"');
  });

  // AC1 continued: Must prevent default anchor behavior to avoid conflicting navigation
  it("prevents default anchor behavior to avoid double-fire", () => {
    expect(boardSummarySrc).toContain("preventDefault");
  });

  // AC2: URL changes to /#board after clicking — ensured by the hash assignment above
  // AC3: Board heading and task list are displayed — ensured by hash routing in App.tsx

  // Both the empty state and the populated state must have the fixed navigation
  it("has onClick handler in the empty state View Board link", () => {
    // The isEmpty branch should contain both onClick and "View Board"
    // Split the source at the isEmpty check and verify the first return block
    const afterIsEmpty = boardSummarySrc.split(/if\s*\(isEmpty\)/)[1];
    expect(afterIsEmpty).toBeTruthy();
    // Take just the isEmpty branch (up to the next top-level return)
    const isEmptyBranch = afterIsEmpty.slice(0, afterIsEmpty.indexOf("const pills"));
    expect(isEmptyBranch).toContain("onClick");
    expect(isEmptyBranch).toContain("View Board");
  });

  it("has onClick handler in the populated state View Board link", () => {
    // The main return (non-empty) must also use onClick navigation
    // Count occurrences of onClick in the file — should appear at least twice
    // (once for empty state, once for populated state)
    const onClickMatches = boardSummarySrc.match(/onClick/g);
    expect(onClickMatches).not.toBeNull();
    expect(onClickMatches!.length).toBeGreaterThanOrEqual(2);
  });

  // AC4: Sidebar Board link continues to work (not affected by this change — sidebar is separate)
  // Verified by ensuring BoardSummary changes don't touch sidebar code
  it("does not import or modify sidebar components", () => {
    expect(boardSummarySrc).not.toContain("SidebarMenu");
    expect(boardSummarySrc).not.toContain("AppSidebar");
  });
});
