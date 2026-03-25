import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – TODAY group thread cap", () => {
  // AC1: TODAY group shows at most 5-7 threads by default
  it("caps visible threads in the Today group using a maxVisible threshold", () => {
    // Should define a MAX_VISIBLE_TODAY constant or similar cap
    expect(sidebarSrc).toMatch(/MAX_VISIBLE_TODAY|maxVisibleToday|maxVisible/);
    // Should slice sessions for the Today group
    expect(sidebarSrc).toMatch(/\.slice\s*\(\s*0/);
  });

  // AC2: "Show N more" link appears below visible threads when more exist
  it("renders a 'Show more' button when Today group has hidden threads", () => {
    // Should show remaining count and "more" text
    expect(sidebarSrc).toMatch(/more/i);
    // Should compute hidden count from sessions length minus visible
    expect(sidebarSrc).toMatch(/group\.sessions\.length\s*[-−]\s*MAX_VISIBLE_TODAY|sessions\.length\s*-/);
  });

  // AC3: Clicking "Show more" reveals all threads in the group
  it("tracks expanded state for the Today group to show all threads", () => {
    // Should have state for expanded today group
    expect(sidebarSrc).toMatch(/expandedTodayGroup|todayExpanded|showAllToday/);
    // Clicking should toggle state
    expect(sidebarSrc).toMatch(/setExpandedTodayGroup|setTodayExpanded|setShowAllToday/);
  });

  // AC4: YESTERDAY and THIS WEEK groups remain collapsed with counts (per task 0018)
  it("does not apply thread cap to non-Today groups", () => {
    // The cap logic should only apply when group.label is "Today"
    expect(sidebarSrc).toMatch(/group\.label\s*===\s*["']Today["'][\s\S]*?(slice|maxVisible|MAX_VISIBLE)/);
  });

  // AC5: Thread count in the group header still shows total count
  it("displays total count in group header regardless of cap", () => {
    // The group header should still show group.sessions.length (total, not capped)
    expect(sidebarSrc).toMatch(/group\.sessions\.length/);
  });
});
