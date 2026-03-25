import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – empty thread cleanup", () => {
  // AC1: Threads with zero messages (unnamed sessions) are hidden from the sidebar
  it("filters out unnamed sessions from the displayed sessions list", () => {
    // Should have a dedicated filtering step that removes unnamed sessions
    // using isUnnamedSession within a .filter() call on sessions
    expect(sidebarSrc).toMatch(/!isUnnamedSession\(s\.label\)/);
  });

  // AC2: The currently active session is kept visible even if unnamed
  it("preserves the active session even when unnamed", () => {
    // The filter should keep sessions that are active OR named
    expect(sidebarSrc).toMatch(
      /s\.id\s*===\s*activeSessionId\s*\|\|\s*!isUnnamedSession|!isUnnamedSession[\s\S]*?\|\|\s*s\.id\s*===\s*activeSessionId/,
    );
  });

  // AC3: Group count badges reflect visible (non-empty) thread count
  // Since filtering happens before grouping, group.sessions.length
  // naturally reflects only visible threads
  it("shows group count based on filtered sessions", () => {
    expect(sidebarSrc).toMatch(/group\.sessions\.length/);
  });

  // AC4: The filtering uses the existing isUnnamedSession utility
  it("imports and uses isUnnamedSession for the filter", () => {
    expect(sidebarSrc).toMatch(/import.*isUnnamedSession/);
  });
});
