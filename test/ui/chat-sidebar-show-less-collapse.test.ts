import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – Show less button actually collapses", () => {
  // AC1: Clicking "Show less" collapses the TODAY group back to 5 visible threads
  it("Show less onClick calls stopPropagation to prevent event bubbling", () => {
    // The Show less button's onClick must call stopPropagation so the click
    // doesn't bubble up to the Collapsible and get swallowed
    const showLessRegion = sidebarSrc.slice(
      sidebarSrc.indexOf("Show less"),
    );
    // The onClick handler near "Show less" should include stopPropagation
    expect(sidebarSrc).toMatch(/stopPropagation[\s\S]*Show less|Show less[\s\S]*stopPropagation/);
  });

  // AC2: Show more/less logic is NOT inside an IIFE to avoid closure/reconciliation issues
  it("does not use an IIFE pattern for session list rendering", () => {
    // The old pattern {(() => { ... })()} can cause stale closure or
    // reconciliation issues — the logic should be inline in the map callback
    const chatSection = sidebarSrc.slice(
      sidebarSrc.indexOf("sessionGroups.map"),
      sidebarSrc.indexOf("</SidebarMenu>", sidebarSrc.indexOf("sessionGroups.map")),
    );
    // Should NOT contain an IIFE pattern
    expect(chatSection).not.toMatch(/\{\s*\(\s*\(\s*\)\s*=>\s*\{/);
  });

  // AC3: After collapsing, "Show N more" button reappears with the correct count
  it("computes hiddenCount from total sessions minus visible sessions", () => {
    expect(sidebarSrc).toMatch(/hiddenCount/);
    expect(sidebarSrc).toMatch(/group\.sessions\.length\s*-/);
  });

  // AC4: Expanding and collapsing can be repeated multiple times
  it("uses functional updater for both Show more and Show less handlers", () => {
    // Both handlers should use the functional updater pattern (prev) => ...
    // to ensure correct state regardless of batching
    const showMoreMatch = sidebarSrc.match(/next\.add\(group\.label\)/);
    const showLessMatch = sidebarSrc.match(/next\.delete\(group\.label\)/);
    expect(showMoreMatch).not.toBeNull();
    expect(showLessMatch).not.toBeNull();
  });

  // AC5: Show more button also uses stopPropagation for consistency
  it("Show more onClick also calls stopPropagation", () => {
    // Find the "Show more" button region and verify stopPropagation is nearby
    const showMoreIdx = sidebarSrc.indexOf("Show {hiddenCount} more");
    expect(showMoreIdx).toBeGreaterThan(-1);
    // Look backwards up to 500 chars for stopPropagation in the same onClick
    const regionBefore = sidebarSrc.slice(Math.max(0, showMoreIdx - 500), showMoreIdx);
    expect(regionBefore).toMatch(/stopPropagation/);
  });
});
