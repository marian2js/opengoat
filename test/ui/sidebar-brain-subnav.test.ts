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

describe("Sidebar Brain sub-navigation", () => {
  // AC1: Brain link in sidebar expands to show sub-pages
  it("renders a collapsible Brain section with sub-menu items", () => {
    expect(sidebarSrc).toContain("Collapsible");
    expect(sidebarSrc).toContain("CollapsibleTrigger");
    expect(sidebarSrc).toContain("CollapsibleContent");
    expect(sidebarSrc).toContain("SidebarMenuSub");
    expect(sidebarSrc).toContain("brainNavigation.map");
  });

  // AC2: Each sub-page is accessible via sidebar click
  it("renders each brain sub-item as a navigable link", () => {
    expect(sidebarSrc).toContain("SidebarMenuSubButton");
    expect(sidebarSrc).toContain("item.href");
    // Brain parent button should also navigate to #brain
    expect(sidebarSrc).toContain("#brain");
  });

  it("Brain parent button navigates to #brain in addition to toggling", () => {
    // The Brain section should have an anchor element or onClick navigating to #brain
    // so clicking Brain goes to the brain view, not just expands the menu
    expect(sidebarSrc).toMatch(/href=["']#brain["']/);
  });

  // AC3: Active sub-page shows an active state indicator
  it("applies isActive prop on the active brain sub-item", () => {
    // isActive should reference activeBrainSection to determine which sub-page is active
    expect(sidebarSrc).toContain("activeBrainSection");
    expect(sidebarSrc).toMatch(/isActive=\{/);
  });

  it("active sub-item has a visible accent indicator class", () => {
    // The active sub-item should have a distinctive left border for visual prominence
    // This goes beyond the default data-active background
    expect(sidebarSrc).toMatch(/border-l|border-primary|ring-primary/);
  });

  // AC4: Sub-page icons match the configured icons from navigation.ts
  it("navigation config defines icons for all 5 brain sub-pages", () => {
    expect(navigationSrc).toContain("PackageIcon");
    expect(navigationSrc).toContain("StoreIcon");
    expect(navigationSrc).toContain("TrendingUpIcon");
    expect(navigationSrc).toContain("BrainIcon");
    expect(navigationSrc).toContain("BookOpenIcon");
  });

  it("sub-items render the icon component from navigation config", () => {
    // Each sub-item renders <item.icon /> inside the SidebarMenuSubButton
    expect(sidebarSrc).toContain("<item.icon");
  });

  // AC5: Works in both light and dark mode
  it("uses theme-aware CSS variables (sidebar-* tokens)", () => {
    // The sidebar should use sidebar- prefixed tokens which adapt to theme
    expect(sidebarSrc).toMatch(/sidebar-accent|sidebar-foreground|sidebar-primary/);
  });

  // AC6: Brain sub-menu collapses when navigating away from Brain page
  it("uses controlled open prop derived from activeView, not defaultOpen", () => {
    // The Collapsible wrapping the Brain section must use the controlled `open`
    // prop so that expand/collapse state tracks the current route, collapsing
    // when the user navigates away from Brain pages.
    // It should NOT use defaultOpen (which only sets initial state and then
    // Radix manages it internally, causing the menu to stay open on all pages).
    expect(sidebarSrc).toMatch(/open=\{activeView\s*===\s*["']brain["']\}/);
    // Ensure defaultOpen is NOT used for the Brain collapsible
    expect(sidebarSrc).not.toMatch(/defaultOpen=\{activeView\s*===\s*["']brain["']\}/);
  });
});
