import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – uniform timestamps", () => {
  // AC1 & AC2: All chat entries in "Today" and "Yesterday" groups show creation timestamps
  it("shows timestamps for recent entries (Today/Yesterday) regardless of duplicates", () => {
    // The timestamp assignment should include isRecent as a condition
    // so entries in Today/Yesterday always get a timestamp
    expect(sidebarSrc).toMatch(/isRecent\s*\|\|\s*duplicateLabels\.has/);
  });

  // AC3: Entries in older date groups show timestamps only for duplicate labels
  it("preserves duplicate-only timestamp logic for older groups via duplicateLabels.has", () => {
    // duplicateLabels.has should still be present (not removed)
    expect(sidebarSrc).toContain("duplicateLabels.has(baseLabel(label))");
  });

  // AC4: Timestamps use the existing formatShortTime format
  it("uses formatShortTime for timestamp value", () => {
    // The timestamp value is derived from formatShortTime(session.createdAt)
    expect(sidebarSrc).toContain("formatShortTime(session.createdAt)");
  });

  // AC5: Timestamp styling uses the existing muted style
  it("renders timestamps with muted sidebar-foreground/40 styling", () => {
    expect(sidebarSrc).toContain("text-sidebar-foreground/40");
    // timestamp rendering should include the dot separator
    expect(sidebarSrc).toMatch(/·\s*\{timestamp\}/);
  });

  // AC6: isRecent is defined based on Today/Yesterday group labels
  it("defines isRecent from Today and Yesterday group labels", () => {
    expect(sidebarSrc).toMatch(
      /isRecent\s*=\s*group\.label\s*===\s*["']Today["']\s*\|\|\s*group\.label\s*===\s*["']Yesterday["']/,
    );
  });
});
