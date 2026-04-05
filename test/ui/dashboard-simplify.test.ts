import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const dashDir = resolve(
  __dirname,
  "../../apps/desktop/src/features/dashboard",
);
const readSrc = (path: string) =>
  readFileSync(resolve(dashDir, path), "utf-8");

describe("Dashboard simplification — Sprint 5 reset", () => {
  // AC1: Dashboard no longer shows removed sections
  describe("AC1: Removed sections from DashboardWorkspace", () => {
    const workspaceSrc = readSrc("components/DashboardWorkspace.tsx");

    it("does not import ActiveObjectiveSection", () => {
      expect(workspaceSrc).not.toContain("ActiveObjectiveSection");
    });

    it("does not import ObjectiveComposerPrompt", () => {
      expect(workspaceSrc).not.toContain("ObjectiveComposerPrompt");
    });

    it("does not import ObjectiveCreationSheet", () => {
      expect(workspaceSrc).not.toContain("ObjectiveCreationSheet");
    });

    it("does not import SinceYouWereAwaySection", () => {
      expect(workspaceSrc).not.toContain("SinceYouWereAwaySection");
    });

    it("does not import OpportunitySection", () => {
      expect(workspaceSrc).not.toContain("OpportunitySection");
    });

    it("does not import PlaybookLibrary", () => {
      expect(workspaceSrc).not.toContain("PlaybookLibrary");
    });

    it("does not render WorkInProgress directly", () => {
      // WorkInProgress section is replaced by NowWorkingOn in Mode B
      expect(workspaceSrc).not.toContain("<WorkInProgress");
    });
  });

  // AC2: Mode A (no active work)
  describe("AC2: Mode A — no active work layout", () => {
    const workspaceSrc = readSrc("components/DashboardWorkspace.tsx");

    it("has mode detection logic using hasActiveWork", () => {
      expect(workspaceSrc).toContain("hasActiveWork");
    });

    it("renders CompanyUnderstandingHero", () => {
      expect(workspaceSrc).toContain("<CompanyUnderstandingHero");
    });

    it("renders ActionCardGrid", () => {
      expect(workspaceSrc).toContain("<ActionCardGrid");
    });

    it("FreeTextInput is embedded inside CompanyUnderstandingHero", () => {
      const heroSrc = readSrc("components/CompanyUnderstandingHero.tsx");
      expect(heroSrc).toContain("<FreeTextInput");
    });

    it("renders RecommendedJobs (replaces SuggestedActionGrid)", () => {
      expect(workspaceSrc).toContain("<RecommendedJobs");
    });

    it("renders RecentOutputs", () => {
      expect(workspaceSrc).toContain("<RecentOutputs");
    });
  });

  // AC3: Mode B (active work exists)
  describe("AC3: Mode B — active work exists layout", () => {
    const workspaceSrc = readSrc("components/DashboardWorkspace.tsx");

    it("renders NowWorkingOn component", () => {
      expect(workspaceSrc).toContain("<NowWorkingOn");
    });

    it("renders BoardSummary", () => {
      expect(workspaceSrc).toContain("<BoardSummary");
    });
  });

  // AC4: Starter action cards have new fields
  describe("AC4: Action cards with new fields", () => {
    const actionsSrc = readSrc("data/actions.ts");

    it("includes timeToFirstOutput field in ActionCard interface", () => {
      expect(actionsSrc).toContain("timeToFirstOutput");
    });

    it("includes createsTrackedWork field in ActionCard interface", () => {
      expect(actionsSrc).toContain("createsTrackedWork");
    });

    it("has exactly 8 starter actions", () => {
      const matches = actionsSrc.match(/\{\s*\n\s*id:\s*"/g);
      expect(matches?.length).toBe(8);
    });

    it("includes 'Launch on Product Hunt' action", () => {
      expect(actionsSrc).toContain("Launch on Product Hunt");
    });

    it("includes 'Rewrite homepage hero' action", () => {
      expect(actionsSrc).toContain("Rewrite homepage hero");
    });

    it("includes 'Improve homepage conversion' action", () => {
      expect(actionsSrc).toContain("Improve homepage conversion");
    });

    it("includes 'Build outbound sequence' action", () => {
      expect(actionsSrc).toContain("Build outbound sequence");
    });

    it("includes 'Find SEO quick wins' action", () => {
      expect(actionsSrc).toContain("Find SEO quick wins");
    });

    it("includes 'Create comparison page outline' action", () => {
      expect(actionsSrc).toContain("Create comparison page outline");
    });

    it("includes 'Generate founder content ideas' action", () => {
      expect(actionsSrc).toContain("Generate founder content ideas");
    });

    it("includes 'Create lead magnet ideas' action", () => {
      expect(actionsSrc).toContain("Create lead magnet ideas");
    });
  });

  // AC4 continued: ActionCardItem renders new fields
  describe("AC4: ActionCardItem renders new fields", () => {
    const cardItemSrc = readSrc("components/ActionCardItem.tsx");

    it("renders timeToFirstOutput", () => {
      expect(cardItemSrc).toContain("timeToFirstOutput");
    });

    it("renders createsTrackedWork indicator", () => {
      expect(cardItemSrc).toContain("createsTrackedWork");
    });
  });

  // AC5: ObjectiveCreationSheet removed from dashboard flow
  describe("AC5: ObjectiveCreationSheet removed from dashboard", () => {
    const workspaceSrc = readSrc("components/DashboardWorkspace.tsx");

    it("does not render ObjectiveCreationSheet", () => {
      expect(workspaceSrc).not.toContain("<ObjectiveCreationSheet");
    });

    it("does not have isCreationOpen state", () => {
      expect(workspaceSrc).not.toContain("isCreationOpen");
    });
  });

  // AC6: Terminology updates
  describe("AC6: Simplified terminology", () => {
    it("RecentOutputs uses 'Recent outputs' heading", () => {
      const src = readSrc("components/RecentOutputs.tsx");
      expect(src).toContain("Recent outputs");
      expect(src).not.toContain("Recent Deliverables");
    });

    it("ArtifactCard uses 'View output' instead of 'Preview artifact'", () => {
      const src = readSrc("components/ArtifactCard.tsx");
      expect(src).toContain("View output");
      expect(src).not.toContain("Preview artifact");
    });

    it("BundleCard uses 'output' instead of 'artifact' in count badge", () => {
      const src = readSrc("components/BundleCard.tsx");
      expect(src).toMatch(/output/);
    });

    it("ActionCardGrid uses 'Quick Actions' heading", () => {
      const src = readSrc("components/ActionCardGrid.tsx");
      expect(src).toContain("Quick Actions");
    });
  });

  // AC7: Free-text input
  describe("AC7: Free-text input replaces objective composer", () => {
    it("FreeTextInput component exists", () => {
      expect(
        existsSync(resolve(dashDir, "components/FreeTextInput.tsx")),
      ).toBe(true);
    });

    it("has placeholder text about help", () => {
      const src = readSrc("components/FreeTextInput.tsx");
      expect(src).toMatch(/What do you want help with/i);
    });

    it("has a submit handler", () => {
      const src = readSrc("components/FreeTextInput.tsx");
      expect(src).toContain("onSubmit");
    });
  });

  // NowWorkingOn component
  describe("NowWorkingOn component", () => {
    it("NowWorkingOn component exists", () => {
      expect(
        existsSync(resolve(dashDir, "components/NowWorkingOn.tsx")),
      ).toBe(true);
    });

    it("shows 'Now working on' label", () => {
      const src = readSrc("components/NowWorkingOn.tsx");
      expect(src).toMatch(/Now working on/i);
    });

    it("has quick action buttons", () => {
      const src = readSrc("components/NowWorkingOn.tsx");
      expect(src).toContain("Continue");
    });

    it("has review and board links", () => {
      const src = readSrc("components/NowWorkingOn.tsx");
      expect(src).toContain("Open Board");
    });
  });
});
