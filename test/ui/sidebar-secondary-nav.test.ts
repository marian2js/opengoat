import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

const navigationSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/config/navigation.ts"),
  "utf-8",
);

describe("Sidebar secondary navigation (Agents, Connections)", () => {
  // AC1: Agents and Connections appear in the sidebar
  it("imports and renders secondaryNavigation items in the sidebar", () => {
    expect(sidebarSrc).toContain("secondaryNavigation");
  });

  it("renders Agents and Connections as sidebar menu items", () => {
    // The sidebar should map over secondaryNavigation to render items
    expect(sidebarSrc).toMatch(/secondaryNavigation\b.*\bmap\b|secondaryNavigation\.filter/s);
  });

  // AC2: Active state is derived from activeView
  it("derives active state for secondary items from activeView prop", () => {
    // Secondary nav items should use the same isActive derivation pattern
    // checking item.href against activeView
    expect(sidebarSrc).toContain("activeView");
  });

  // AC3: No stale active state — active state is purely derived, not stored
  it("does not store active state in component state (no stale highlighting)", () => {
    // Active state must be derived from props, not from useState
    // The isActive prop on secondary items should reference activeView
    // Verify no separate state for tracking "last active sidebar item"
    expect(sidebarSrc).not.toMatch(/useState.*activeSidebar|useState.*lastActive/);
  });

  // AC4: Secondary navigation config defines Agents and Connections with icons
  it("navigation config defines Agents with BotIcon", () => {
    expect(navigationSrc).toContain("BotIcon");
    expect(navigationSrc).toMatch(/title:\s*["']Agents["']/);
    expect(navigationSrc).toMatch(/href:\s*["']#agents["']/);
  });

  it("navigation config defines Connections with Link2Icon", () => {
    expect(navigationSrc).toContain("Link2Icon");
    expect(navigationSrc).toMatch(/title:\s*["']Connections["']/);
    expect(navigationSrc).toMatch(/href:\s*["']#connections["']/);
  });

  // AC5: Settings is excluded from sidebar nav (already in footer)
  it("filters out Settings from secondary navigation in the sidebar", () => {
    // Settings should remain in the footer as a gear icon, not duplicated
    expect(sidebarSrc).toMatch(/secondaryNavigation[\s\S]*\.filter[\s\S]*#settings/);
  });
});
