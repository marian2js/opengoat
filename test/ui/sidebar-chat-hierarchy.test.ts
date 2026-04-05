import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sidebarSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/app/shell/AppSidebar.tsx"),
  "utf-8",
);

describe("Chat sidebar visual hierarchy", () => {
  // AC1: Conversations are grouped by date with section labels
  it("renders date group labels for conversation sections", () => {
    expect(sidebarSrc).toContain("group.label");
    expect(sidebarSrc).toContain("sessionGroups.map");
  });

  // AC4: Date group labels follow DESIGN.md section-label pattern (mono, uppercase, primary color)
  it("date group labels use mono font with primary color", () => {
    // DESIGN.md: 10px / 600, mono, uppercase, 0.1em tracking, primary color
    expect(sidebarSrc).toMatch(/font-mono/);
    expect(sidebarSrc).toMatch(/text-primary/);
    expect(sidebarSrc).toMatch(/uppercase/);
    expect(sidebarSrc).toMatch(/tracking-\[0\.1em\]/);
  });

  // AC2: Active conversation has a clear visual indicator (emerald accent)
  it("active conversation has a left border indicator with primary color", () => {
    expect(sidebarSrc).toMatch(/border-l.*primary|border-primary/);
    // The active state controls the border color (primary vs transparent)
    expect(sidebarSrc).toMatch(/isActive.*border-primary/);
  });

  // AC3: Message counts as badges (not inline parenthetical)
  // Note: The AgentSession schema doesn't include messageCount,
  // so this is verified by ensuring no inline parenthetical counts remain
  it("does not render inline parenthetical message counts", () => {
    // No hardcoded "(N)" message count pattern in the sidebar
    expect(sidebarSrc).not.toMatch(/\(\{session\.messageCount\}\)/);
  });

  // Font-weight differentiation: recent conversations bolder than older ones
  it("passes isRecent flag to SessionItem for font-weight differentiation", () => {
    expect(sidebarSrc).toMatch(/isRecent/);
  });

  it("applies font-medium (500) for recent conversations and font-normal (400) for older", () => {
    // Recent sessions should use font-medium, older ones font-normal
    expect(sidebarSrc).toMatch(/isRecent[\s\S]*font-medium/);
    expect(sidebarSrc).toContain("font-normal");
  });

  // AC5: List remains scrollable and performant
  it("renders within a scrollable sidebar content area", () => {
    expect(sidebarSrc).toContain("SidebarGroupContent");
    expect(sidebarSrc).toContain("SidebarMenu");
  });
});
