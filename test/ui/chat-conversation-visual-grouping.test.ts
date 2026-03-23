import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar – visual grouping and conversation distinction", () => {
  // AC1: Conversations are grouped under date headers (Today, Yesterday, etc.)
  it("renders date group headers from groupSessionsByDate", () => {
    expect(src).toContain("groupSessionsByDate");
    expect(src).toContain("group.label");
  });

  it("date group headers use DESIGN.md section-label pattern (mono, uppercase, primary color)", () => {
    // The group header label should use the DESIGN.md section-label pattern:
    // 10px / 600, mono, uppercase, 0.1em tracking, primary color
    expect(src).toMatch(/uppercase/);
    expect(src).toMatch(/tracking-\[0\.1em\]/);
    expect(src).toMatch(/text-\[10px\]/);
    expect(src).toMatch(/font-mono/);
    expect(src).toMatch(/text-primary/);
  });

  // AC2: Named conversations are visually distinguishable from generic "New conversation" items
  it("applies font-medium to named (non-unnamed) conversation labels", () => {
    // The SessionItem component should apply font-medium when the session is named
    const sessionItemStart = src.indexOf("function SessionItem");
    expect(sessionItemStart).toBeGreaterThan(0);
    const sessionItemBody = src.slice(sessionItemStart);
    // Named sessions should get font-medium on the label text
    expect(sessionItemBody).toContain("font-medium");
    // Unnamed sessions should remain italic
    expect(sessionItemBody).toContain("italic");
  });

  it("differentiates named conversations with non-italic weight text based on recency", () => {
    const sessionItemStart = src.indexOf("function SessionItem");
    const sessionItemBody = src.slice(sessionItemStart);
    // The unnamed check is used to conditionally apply different styles
    expect(sessionItemBody).toContain("isUnnamedSession");
    // Named sessions should NOT be italic — unnamed get italic, recent named get font-medium, older get font-normal
    expect(sessionItemBody).toContain("italic");
    expect(sessionItemBody).toContain("font-medium");
    expect(sessionItemBody).toContain("font-normal");
  });

  // AC3: The sidebar is easier to scan and navigate
  it("uses the isUnnamedSession utility for visual distinction", () => {
    expect(src).toContain('import { isUnnamedSession }');
  });

  it("de-emphasizes unnamed sessions with reduced opacity", () => {
    const sessionItemStart = src.indexOf("function SessionItem");
    const sessionItemBody = src.slice(sessionItemStart);
    // Unnamed sessions should have lower visual weight
    expect(sessionItemBody).toContain("text-sidebar-foreground/50");
  });

  // AC4: Works in both light and dark mode (uses theme-aware sidebar token classes)
  it("uses theme-aware sidebar token classes", () => {
    const sessionItemStart = src.indexOf("function SessionItem");
    const sessionItemBody = src.slice(sessionItemStart);
    // Should use sidebar semantic tokens instead of hardcoded colors
    expect(sessionItemBody).toContain("text-sidebar-foreground");
  });

  it("group headers use sidebar-foreground semantic token", () => {
    // The date group divider text should use sidebar semantic tokens for theme compatibility
    expect(src).toContain("text-sidebar-foreground/50");
  });
});
