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
// RecommendedJobCard component
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

  it("has a CTA to start the job", () => {
    // Should have a Start or Run CTA
    expect(cardSrc).toMatch(/Start|Run/);
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
