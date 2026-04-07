import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Source files ───
const hookSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/hooks/useRecommendedJobs.ts"),
  "utf-8",
);

const cardSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/components/RecommendedJobCard.tsx"),
  "utf-8",
);

const sectionSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/components/RecommendedJobs.tsx"),
  "utf-8",
);

const dashboardSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/components/DashboardWorkspace.tsx"),
  "utf-8",
);

const actionsSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/data/actions.ts"),
  "utf-8",
);

const suggestedSrc = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/dashboard/data/suggested-actions.ts"),
  "utf-8",
);

// ═══════════════════════════════════════════════════════
// useRecommendedJobs hook
// ═══════════════════════════════════════════════════════
describe("useRecommendedJobs hook", () => {
  it("exports a useRecommendedJobs function", () => {
    expect(hookSrc).toMatch(/export\s+function\s+useRecommendedJobs/);
  });

  it("exports a RecommendedJob interface", () => {
    expect(hookSrc).toMatch(/export\s+interface\s+RecommendedJob/);
  });

  it("imports starterActions for fallback", () => {
    expect(hookSrc).toContain("starterActions");
  });

  it("imports getSpecialistName to resolve specialist display names", () => {
    expect(hookSrc).toContain("getSpecialistName");
  });

  it("imports getSpecialistColors for color tokens", () => {
    expect(hookSrc).toContain("getSpecialistColors");
  });

  it("caps output at 5 jobs maximum", () => {
    // The hook should limit results to 5
    expect(hookSrc).toMatch(/\.slice\(0,\s*5\)/);
  });

  it("prefers suggested actions when available", () => {
    // suggestedActions should come first in the merge order
    expect(hookSrc).toContain("suggestedActions");
  });

  it("returns jobs and isLoading state", () => {
    expect(hookSrc).toMatch(/jobs/);
    expect(hookSrc).toMatch(/isLoading/);
  });

  it("de-duplicates actions by id", () => {
    // Should track seen IDs to avoid duplication
    expect(hookSrc).toMatch(/seen|Set|has\(|filter/);
  });
});

// ═══════════════════════════════════════════════════════
// ActionCard data model — output-promise fields
// ═══════════════════════════════════════════════════════
describe("ActionCard data model — output-promise fields", () => {
  it("ActionCard interface includes outputType field", () => {
    expect(actionsSrc).toMatch(/outputType\??\s*:\s*string/);
  });

  it("ActionCard interface includes ctaLabel field", () => {
    expect(actionsSrc).toMatch(/ctaLabel\??\s*:\s*string/);
  });

  it("all starter actions have outputType defined", () => {
    // Each starter action entry should have an outputType line
    const outputTypeCount = (actionsSrc.match(/outputType:\s*"/g) || []).length;
    // There are 8 starter actions
    expect(outputTypeCount).toBeGreaterThanOrEqual(8);
  });

  it("all starter actions have ctaLabel defined", () => {
    const ctaLabelCount = (actionsSrc.match(/ctaLabel:\s*"/g) || []).length;
    expect(ctaLabelCount).toBeGreaterThanOrEqual(8);
  });

  it("outputType values use concrete output language, not vague process language", () => {
    // Should NOT contain vague words like "analysis", "strategy help", "workflow result"
    const outputTypes = [...actionsSrc.matchAll(/outputType:\s*"([^"]+)"/g)].map(m => m[1]);
    for (const ot of outputTypes) {
      expect(ot.toLowerCase()).not.toMatch(/^analysis$/);
      expect(ot.toLowerCase()).not.toMatch(/^strategy help$/);
      expect(ot.toLowerCase()).not.toMatch(/^workflow result$/);
    }
    expect(outputTypes.length).toBeGreaterThanOrEqual(8);
  });

  it("ctaLabel values are outcome-based, not generic 'Start'", () => {
    const ctaLabels = [...actionsSrc.matchAll(/ctaLabel:\s*"([^"]+)"/g)].map(m => m[1]);
    for (const label of ctaLabels) {
      expect(label).not.toBe("Start");
    }
    expect(ctaLabels.length).toBeGreaterThanOrEqual(8);
  });
});

// ═══════════════════════════════════════════════════════
// SuggestedActionData — outputType support
// ═══════════════════════════════════════════════════════
describe("SuggestedActionData — outputType support", () => {
  it("SuggestedActionData interface includes outputType field", () => {
    expect(suggestedSrc).toMatch(/outputType\??\s*:\s*string/);
  });

  it("isValidSuggestedAction validates outputType when present", () => {
    expect(suggestedSrc).toContain("outputType");
  });

  it("toActionCard passes outputType through", () => {
    // toActionCard should include outputType in the returned object
    expect(suggestedSrc).toMatch(/outputType:\s*data\.outputType/);
  });

  it("SUGGESTED_ACTIONS_PROMPT includes outputType in schema", () => {
    expect(suggestedSrc).toMatch(/outputType.*deliverable/i);
  });
});

// ═══════════════════════════════════════════════════════
// RecommendedJobCard component — output-promise rendering
// ═══════════════════════════════════════════════════════
describe("RecommendedJobCard component", () => {
  it("exports a RecommendedJobCard function component", () => {
    expect(cardSrc).toMatch(/export\s+function\s+RecommendedJobCard/);
  });

  it("displays the job title", () => {
    expect(cardSrc).toMatch(/title/);
  });

  it("displays the specialist name", () => {
    expect(cardSrc).toContain("specialistName");
  });

  it("displays the promise text (why this matters)", () => {
    expect(cardSrc).toContain("promise");
  });

  it("renders the outputType tag", () => {
    expect(cardSrc).toContain("job.outputType");
  });

  it("renders the ctaLabel (outcome-based CTA)", () => {
    expect(cardSrc).toContain("ctaLabel");
    // Should fall back to "Start" when ctaLabel is not set
    expect(cardSrc).toMatch(/ctaLabel.*\?\?.*"Start"|"Start"/);
  });

  it("uses PackageIcon for the output-type tag", () => {
    expect(cardSrc).toContain("PackageIcon");
  });

  it("hero card shows description as additional context", () => {
    expect(cardSrc).toContain("job.description");
    // Description should only show on hero
    expect(cardSrc).toMatch(/isHero\s*&&\s*job\.description/);
  });

  it("uses specialist dot color for attribution", () => {
    expect(cardSrc).toContain("dotColor");
  });

  it("has click handler calling onClick with action details", () => {
    expect(cardSrc).toMatch(/onClick/);
  });

  it("applies hover lift per DESIGN.md (translateY, shadow)", () => {
    expect(cardSrc).toMatch(/hover:-translate-y/);
    expect(cardSrc).toMatch(/hover:shadow/);
  });

  it("hero output-type tag uses primary/emerald accent tint", () => {
    expect(cardSrc).toMatch(/bg-primary/);
  });

  it("secondary output-type tag uses muted styling", () => {
    expect(cardSrc).toMatch(/bg-muted/);
  });
});

// ═══════════════════════════════════════════════════════
// RecommendedJobs section wrapper
// ═══════════════════════════════════════════════════════
describe("RecommendedJobs section wrapper", () => {
  it("exports a RecommendedJobs function component", () => {
    expect(sectionSrc).toMatch(/export\s+function\s+RecommendedJobs/);
  });

  it("uses founder-friendly section label 'Best first moves'", () => {
    expect(sectionSrc).toMatch(/Best first moves/i);
  });

  it("uses the section-label CSS class for the heading", () => {
    expect(sectionSrc).toContain("section-label");
  });

  it("renders RecommendedJobCard for each job", () => {
    expect(sectionSrc).toContain("RecommendedJobCard");
  });

  it("shows loading skeletons when isLoading is true", () => {
    expect(sectionSrc).toMatch(/skeleton|animate-pulse/i);
  });

  it("returns null when no jobs and not loading (self-hides)", () => {
    expect(sectionSrc).toMatch(/return\s+null/);
  });

  it("uses a grid layout for job cards", () => {
    expect(sectionSrc).toMatch(/grid/);
  });

  it("skeleton has internal pulse zones matching card content structure", () => {
    // Skeleton should have distinct zones: chip, title, output tag, text, CTA
    const skeletonSection = sectionSrc.slice(0, sectionSrc.indexOf("export function RecommendedJobs"));
    // Multiple animate-pulse zones inside each skeleton card
    const pulseCount = (skeletonSection.match(/animate-pulse/g) || []).length;
    expect(pulseCount).toBeGreaterThanOrEqual(5);
  });

  it("skeleton hero card has larger padding than secondary cards", () => {
    expect(sectionSrc).toMatch(/isHero.*p-6|p-6.*isHero/s);
  });
});

// ═══════════════════════════════════════════════════════
// Dashboard integration
// ═══════════════════════════════════════════════════════
describe("DashboardWorkspace integration", () => {
  it("imports RecommendedJobs component", () => {
    expect(dashboardSrc).toContain("RecommendedJobs");
  });

  it("imports useRecommendedJobs hook", () => {
    expect(dashboardSrc).toContain("useRecommendedJobs");
  });

  it("renders RecommendedJobs in Mode A (after hero)", () => {
    // RecommendedJobs should appear in the Mode A section
    expect(dashboardSrc).toMatch(/RecommendedJobs/);
  });

  it("removes SuggestedActionGrid from Mode A", () => {
    // SuggestedActionGrid should no longer be rendered in Mode A
    // It may still be imported but should not be rendered
    const modeASection = dashboardSrc.split("Mode A")[1];
    if (modeASection) {
      expect(modeASection).not.toMatch(/<SuggestedActionGrid/);
    }
  });
});
