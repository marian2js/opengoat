import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const navigationSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/app/config/navigation.ts",
  ),
  "utf-8",
);

const sidebarSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/app/shell/AppSidebar.tsx",
  ),
  "utf-8",
);

describe("Board demoted navigation", () => {
  it("Board is NOT in primaryNavigation array", () => {
    // primaryNavigation array ends at the closing ];  before demotedNavigation
    const primaryStart = navigationSrc.indexOf("primaryNavigation: NavigationItem[]");
    const primaryEnd = navigationSrc.indexOf("];", primaryStart);
    const primaryBlock = navigationSrc.slice(primaryStart, primaryEnd);
    expect(primaryBlock).not.toContain('"Board"');
  });

  it("primaryNavigation has only Dashboard, Agents, Chat", () => {
    const primaryStart = navigationSrc.indexOf("primaryNavigation: NavigationItem[]");
    const primaryEnd = navigationSrc.indexOf("];", primaryStart);
    const primaryBlock = navigationSrc.slice(primaryStart, primaryEnd);
    expect(primaryBlock).toContain('"Dashboard"');
    expect(primaryBlock).toContain('"Agents"');
    expect(primaryBlock).toContain('"Chat"');
  });

  it("exports a demotedNavigation array containing Board", () => {
    expect(navigationSrc).toContain("demotedNavigation");
    const demotedStart = navigationSrc.indexOf("demotedNavigation");
    const demotedBlock = navigationSrc.slice(demotedStart);
    expect(demotedBlock).toContain('"Board"');
    expect(demotedBlock).toContain("#board");
  });

  it("sidebar imports demotedNavigation", () => {
    expect(sidebarSrc).toContain("demotedNavigation");
  });

  it("sidebar renders demoted Board between primary nav and Brain collapsible", () => {
    // In the JSX render section, find positions
    const renderStart = sidebarSrc.indexOf("<SidebarContent");
    const renderSection = sidebarSrc.slice(renderStart);
    const primaryNavEnd = renderSection.indexOf("primaryNavigation.map");
    const demotedPos = renderSection.indexOf("demotedNavigation");
    const brainPos = renderSection.indexOf('tooltip="Brain"');
    expect(primaryNavEnd).toBeGreaterThan(0);
    expect(demotedPos).toBeGreaterThan(primaryNavEnd);
    expect(brainPos).toBeGreaterThan(demotedPos);
  });

  it("Board nav route (#board) still exists in some navigation export", () => {
    expect(navigationSrc).toContain("#board");
  });
});
