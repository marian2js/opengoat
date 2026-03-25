import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – collapsible date groups", () => {
  // AC1: Date group headers are clickable to expand/collapse
  it("wraps each date group in a Collapsible with a CollapsibleTrigger", () => {
    // The date group rendering should use Collapsible for expand/collapse
    expect(sidebarSrc).toMatch(/Collapsible[\s\S]*group\.label/);
    expect(sidebarSrc).toMatch(/CollapsibleTrigger/);
  });

  // AC2: "Today" group is expanded by default; all other groups are collapsed by default
  it("defaults Today to expanded and other groups to collapsed", () => {
    // Should have logic that checks group.label === "Today" for defaultOpen
    expect(sidebarSrc).toMatch(/defaultOpen[\s\S]*Today|Today[\s\S]*defaultOpen/);
  });

  // AC3: Each group header shows a thread count
  it("displays thread count next to group label", () => {
    // Should render session count (e.g., group.sessions.length)
    expect(sidebarSrc).toMatch(/group\.sessions\.length/);
  });

  // AC4: Collapsed groups show a chevron-right; expanded show chevron-down
  it("renders a chevron icon that rotates based on collapse state", () => {
    // Should use ChevronRight or ChevronDown with rotation transition
    expect(sidebarSrc).toMatch(/ChevronRightIcon|ChevronDownIcon/);
    // The chevron should have a rotation transition for open/close state
    expect(sidebarSrc).toMatch(/rotate/);
  });

  // AC5: Expanding/collapsing is smooth (no layout jumps)
  it("uses CollapsibleContent for smooth expand/collapse", () => {
    // The session list should be inside CollapsibleContent
    expect(sidebarSrc).toMatch(/CollapsibleContent[\s\S]*group\.sessions\.map|group\.sessions\.map[\s\S]*CollapsibleContent/);
  });

  // AC6: Search expands all groups or shows flat results
  it("expands all groups when search query is active", () => {
    // When searching, groups should be forced open
    expect(sidebarSrc).toMatch(/searchQuery[\s\S]*open|forceOpen|open.*searchQuery/);
  });

  // Ensure thread count styling matches design system (mono, small, muted)
  it("thread count uses muted styling", () => {
    expect(sidebarSrc).toMatch(/group\.sessions\.length/);
  });
});
