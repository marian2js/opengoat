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

  it("date group headers use uppercase tracking-wider styling", () => {
    // The group header label should use small uppercase styling for clear visual separation
    expect(src).toMatch(/uppercase/);
    expect(src).toMatch(/tracking-wider/);
    expect(src).toMatch(/text-\[10px\]/);
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

  it("differentiates named conversations with non-italic normal weight text", () => {
    const sessionItemStart = src.indexOf("function SessionItem");
    const sessionItemBody = src.slice(sessionItemStart);
    // The unnamed check is used to conditionally apply different styles
    expect(sessionItemBody).toContain("isUnnamedSession");
    // Named sessions should NOT be italic — only unnamed get italic (ternary: unnamed ? "italic" : "font-medium")
    expect(sessionItemBody).toMatch(/unnamed\s*\?\s*"italic"\s*:\s*"font-medium"/);
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
