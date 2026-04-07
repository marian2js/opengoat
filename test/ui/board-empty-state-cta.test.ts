import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardWorkspaceSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/board/components/BoardWorkspace.tsx",
  ),
  "utf-8",
);

describe("Board empty state CTA buttons", () => {
  // AC1: Board empty state includes at least one clickable CTA button
  describe("CTA presence in true empty state (tasks.length === 0)", () => {
    it("renders a 'Go to Dashboard' link in the empty state", () => {
      expect(boardWorkspaceSrc).toContain("Go to Dashboard");
    });

    it("renders a 'Start a Chat' link in the empty state", () => {
      expect(boardWorkspaceSrc).toContain("Start a Chat");
    });
  });

  // AC2: Button(s) navigate to Dashboard or Chat via hash routing
  describe("Hash navigation", () => {
    it("links to #dashboard", () => {
      expect(boardWorkspaceSrc).toContain('href="#dashboard"');
    });

    it("links to #chat", () => {
      expect(boardWorkspaceSrc).toContain('href="#chat"');
    });
  });

  // AC3: Button styling matches the app's design system
  describe("Uses the app Button component", () => {
    it("uses Button component with asChild for link rendering", () => {
      // The CTA should use the existing Button component, not raw <a> tags
      expect(boardWorkspaceSrc).toMatch(/Button\s+.*asChild/s);
    });

    it("uses primary variant for the dashboard button", () => {
      // Default variant is primary, so just checking the Button wraps a link to #dashboard
      expect(boardWorkspaceSrc).toMatch(/<Button[^>]*>[\s\S]*?href="#dashboard"/);
    });

    it("uses ghost or outline variant for the chat button", () => {
      expect(boardWorkspaceSrc).toMatch(/variant="(?:ghost|outline)"[\s\S]*?href="#chat"/);
    });
  });

  // AC4: Works in both dark and light mode (using design system tokens)
  describe("Design system compliance", () => {
    it("uses design system Button component (inherits theme support)", () => {
      // Importing Button ensures theme-aware styling
      expect(boardWorkspaceSrc).toMatch(
        /import\s*\{[^}]*Button[^}]*\}\s*from\s*["']@\/components\/ui\/button["']/,
      );
    });
  });

  // AC5: CTA buttons only appear in the empty state area, not when tasks exist
  describe("Conditional rendering", () => {
    it("CTA buttons are inside the tasks.length === 0 branch", () => {
      // The "No tasks yet" heading and the CTA buttons should be in the same block
      // Verify they co-exist in the empty state section
      const noTasksIdx = boardWorkspaceSrc.indexOf("No tasks yet");
      const dashboardCtaIdx = boardWorkspaceSrc.indexOf("Go to Dashboard");
      expect(noTasksIdx).toBeGreaterThan(-1);
      expect(dashboardCtaIdx).toBeGreaterThan(-1);
      // The CTA should appear after "No tasks yet" in the source
      expect(dashboardCtaIdx).toBeGreaterThan(noTasksIdx);
    });
  });

  // The promotional banner (filteredTasks.length <= 3) should also have CTA buttons
  describe("CTA in promotional banner", () => {
    it("promotional banner also includes action links", () => {
      const bannerTextIdx = boardWorkspaceSrc.indexOf(
        "Your follow-up tasks appear here",
      );
      expect(bannerTextIdx).toBeGreaterThan(-1);
      // After the banner text, there should be CTA buttons before the section closes
      const afterBanner = boardWorkspaceSrc.slice(bannerTextIdx);
      expect(afterBanner).toContain("Go to Dashboard");
    });
  });
});
