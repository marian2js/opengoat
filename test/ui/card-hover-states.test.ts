import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Per DESIGN.md, all interactive cards must share:
 *   transition-all duration-100 ease-out
 *   hover:-translate-y-px
 *   hover:shadow-md
 *   hover:border-primary/25
 */

const DASHBOARD_DIR = "apps/desktop/src/features/dashboard/components";
const AGENTS_DIR = "apps/desktop/src/features/agents/components";

function readComponent(dir: string, file: string): string {
  return readFileSync(resolve(__dirname, "../..", dir, file), "utf-8");
}

const STANDARD_HOVER_CLASSES = [
  "hover:-translate-y-px",
  "hover:shadow-md",
  "hover:border-primary/25",
  "duration-100",
];

describe("Card hover states — DESIGN.md compliance", () => {
  describe("ActionCardItem (dashboard specialist cards)", () => {
    const src = readComponent(DASHBOARD_DIR, "ActionCardItem.tsx");

    it("uses 100ms duration", () => {
      expect(src).toContain("duration-100");
    });

    it("hero cards have hover:-translate-y-px", () => {
      expect(src).toContain("hover:-translate-y-px");
    });

    it("hero cards have hover:shadow-md", () => {
      expect(src).toContain("hover:shadow-md");
    });

    it("hero cards have hover:border-primary/25", () => {
      expect(src).toContain("hover:border-primary/25");
    });
  });

  describe("RecommendedJobCard (dashboard job cards)", () => {
    const src = readComponent(DASHBOARD_DIR, "RecommendedJobCard.tsx");

    for (const cls of STANDARD_HOVER_CLASSES) {
      it(`has ${cls}`, () => {
        expect(src).toContain(cls);
      });
    }
  });

  describe("ArtifactCard (dashboard output cards)", () => {
    const src = readComponent(DASHBOARD_DIR, "ArtifactCard.tsx");

    for (const cls of STANDARD_HOVER_CLASSES) {
      it(`has ${cls}`, () => {
        expect(src).toContain(cls);
      });
    }
  });

  describe("BundleCard (dashboard bundle cards)", () => {
    const src = readComponent(DASHBOARD_DIR, "BundleCard.tsx");

    for (const cls of STANDARD_HOVER_CLASSES) {
      it(`has ${cls}`, () => {
        expect(src).toContain(cls);
      });
    }
  });

  describe("PlaybookCard (dashboard playbook cards)", () => {
    const src = readComponent(DASHBOARD_DIR, "PlaybookCard.tsx");

    for (const cls of STANDARD_HOVER_CLASSES) {
      it(`has ${cls}`, () => {
        expect(src).toContain(cls);
      });
    }
  });

  describe("OpportunityCard (dashboard insight cards)", () => {
    const src = readComponent(DASHBOARD_DIR, "OpportunityCard.tsx");

    for (const cls of STANDARD_HOVER_CLASSES) {
      it(`has ${cls}`, () => {
        expect(src).toContain(cls);
      });
    }
  });

  describe("FeedItemCard (dashboard feed cards)", () => {
    const src = readComponent(DASHBOARD_DIR, "FeedItem.tsx");

    for (const cls of STANDARD_HOVER_CLASSES) {
      it(`has ${cls}`, () => {
        expect(src).toContain(cls);
      });
    }
  });

  describe("HeroRecommendedMove (dashboard hero CTA)", () => {
    const src = readComponent(DASHBOARD_DIR, "HeroRecommendedMove.tsx");

    for (const cls of STANDARD_HOVER_CLASSES) {
      it(`has ${cls}`, () => {
        expect(src).toContain(cls);
      });
    }
  });

  describe("RecentOutputs example cards (dashboard empty state)", () => {
    const src = readComponent(DASHBOARD_DIR, "RecentOutputs.tsx");

    for (const cls of STANDARD_HOVER_CLASSES) {
      it(`has ${cls}`, () => {
        expect(src).toContain(cls);
      });
    }
  });

  describe("SpecialistCard (agents page)", () => {
    const src = readComponent(AGENTS_DIR, "SpecialistCard.tsx");

    for (const cls of STANDARD_HOVER_CLASSES) {
      it(`has ${cls}`, () => {
        expect(src).toContain(cls);
      });
    }
  });

  describe("Non-interactive containers are NOT affected", () => {
    it("BrainWorkspace does not use interactive hover translate", () => {
      const src = readComponent(
        "apps/desktop/src/features/brain/components",
        "BrainWorkspace.tsx",
      );
      expect(src).not.toContain("hover:-translate-y-px");
    });
  });
});
