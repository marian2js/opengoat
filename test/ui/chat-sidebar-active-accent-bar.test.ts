import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

// Extract the SessionItem function body for scoped assertions
const sessionItemStart = sidebarSrc.indexOf("function SessionItem");
const sessionItemBody = sidebarSrc.slice(sessionItemStart);

describe("Chat sidebar – active accent bar", () => {
  // AC1: Active chat entry shows a left emerald accent bar
  it("applies border-l-2 with primary color to active chat entry", () => {
    expect(sessionItemBody).toContain("border-l-2");
    expect(sessionItemBody).toContain("border-primary");
  });

  // AC2: Inactive entries maintain consistent left alignment (transparent border)
  it("applies transparent left border to inactive entries for consistent alignment", () => {
    expect(sessionItemBody).toContain("border-transparent");
  });

  // AC3: All entries have a consistent 2px left border (no layout shift)
  it("all entries have border-l-2 regardless of active state", () => {
    // border-l-2 should be applied unconditionally (not inside isActive conditional)
    // Find the className area of the non-editing return path
    const normalReturn = sessionItemBody.indexOf("SidebarMenuButton");
    const classNameArea = sessionItemBody.slice(normalReturn, normalReturn + 500);
    // border-l-2 should appear as a base class, not gated by isActive
    expect(classNameArea).toMatch(/["'`]border-l-2/);
  });

  // AC4: Active entry uses primary border color and background tint
  it("active entry has background tint with emerald accent", () => {
    expect(sessionItemBody).toContain("bg-primary/[0.08]");
  });

  // AC5: Active entry has font-medium for text emphasis
  it("active entry has font-medium weight", () => {
    expect(sessionItemBody).toContain("font-medium");
  });
});
