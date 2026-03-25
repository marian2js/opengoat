import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – action thread timestamps", () => {
  // AC1: Action session threads with duplicate names show a timestamp differentiator
  it("computes duplicate labels within each group to decide which threads need timestamps", () => {
    // Should have logic to count label occurrences within a group
    expect(sidebarSrc).toMatch(/duplicateLabels|labelCounts|labelFreq/);
  });

  // AC2: Timestamp is visually subordinate to the thread title (smaller, muted color)
  it("renders timestamp with muted, smaller styling", () => {
    // Should use text-xs and text-muted-foreground or text-sidebar-foreground/50 for the timestamp
    expect(sidebarSrc).toMatch(/text-\[?(?:xs|10px|11px)\]?[\s\S]*?text-(?:muted-foreground|sidebar-foreground\/\d+)/);
  });

  // AC3: SessionItem accepts a timestamp prop for display
  it("passes a timestamp or showTimestamp prop to SessionItem", () => {
    expect(sidebarSrc).toMatch(/timestamp[=:]/i);
  });

  // AC4: Timestamp is rendered inline with separator
  it("renders the timestamp inline with a separator character", () => {
    // Should use · or — as separator between label and time
    expect(sidebarSrc).toMatch(/[·—•·]/);
  });

  // AC5: Only shows timestamp for duplicate-name threads, not unique ones
  it("conditionally shows timestamp only for threads with duplicate labels in the group", () => {
    // The timestamp should be conditional on duplicate detection
    expect(sidebarSrc).toMatch(/timestamp[\s\S]*?\?|duplicateLabels[\s\S]*?\.has|labelCounts/);
  });

  // AC6: Uses formatShortTime utility for time formatting
  it("imports and uses the formatShortTime utility", () => {
    expect(sidebarSrc).toMatch(/formatShortTime/);
  });
});
