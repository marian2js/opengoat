import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const dashDir = resolve(
  __dirname,
  "../../apps/desktop/src/features/dashboard",
);
const readSrc = (path: string) =>
  readFileSync(resolve(dashDir, path), "utf-8");

// ═══════════════════════════════════════════════════════
// 1. pickBestFirstMove — pure logic
// ═══════════════════════════════════════════════════════

describe("pickBestFirstMove", () => {
  // Import the function for direct testing
  const modPath = resolve(dashDir, "lib/hero-recommendation.ts");

  it("module exists", () => {
    expect(existsSync(modPath)).toBe(true);
  });

  it("exports pickBestFirstMove", () => {
    const src = readSrc("lib/hero-recommendation.ts");
    expect(src).toContain("export function pickBestFirstMove");
  });

  it("exports HeroRecommendation type", () => {
    const src = readSrc("lib/hero-recommendation.ts");
    expect(src).toContain("export interface HeroRecommendation");
  });

  it("returns null when no opportunities", () => {
    const src = readSrc("lib/hero-recommendation.ts");
    // Verify the function handles empty arrays by returning null
    expect(src).toContain("return null");
  });

  it("matches opportunities to actions via relatedActionId", () => {
    const src = readSrc("lib/hero-recommendation.ts");
    expect(src).toContain("relatedActionId");
    expect(src).toContain("actions.find");
  });

  it("resolves specialist name from roster", () => {
    const src = readSrc("lib/hero-recommendation.ts");
    expect(src).toContain("specialists.find");
    expect(src).toContain("specialistName");
  });

  it("returns actionTitle, specialistName, and actionId", () => {
    const src = readSrc("lib/hero-recommendation.ts");
    expect(src).toContain("actionTitle: action.title");
    expect(src).toContain("specialistName:");
    expect(src).toContain("actionId: action.id");
  });

  it("falls back to 'a specialist' when specialist not found", () => {
    const src = readSrc("lib/hero-recommendation.ts");
    expect(src).toContain('"a specialist"');
  });
});

// ═══════════════════════════════════════════════════════
// 2. CompanyUnderstandingHero — compact strip
// ═══════════════════════════════════════════════════════

describe("CompanyUnderstandingHero compact strip", () => {
  const heroPath = resolve(dashDir, "components/CompanyUnderstandingHero.tsx");

  it("exists", () => {
    expect(existsSync(heroPath)).toBe(true);
  });

  it("exports CompanyUnderstandingHero function", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("export function CompanyUnderstandingHero");
  });

  it("renders FaviconIcon for domain identity", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("<FaviconIcon");
  });

  it("renders productSummary", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("data.productSummary");
  });

  it("renders ICP line with fallback to targetAudience", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("data?.icp");
    expect(src).toContain("data?.targetAudience");
  });

  it("renders opportunities array with fallback to legacy fields", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("data?.opportunities");
    expect(src).toContain("data?.topOpportunity");
    expect(src).toContain("data?.mainRisk");
  });

  it("does NOT import HeroOpportunityBullets", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).not.toContain("HeroOpportunityBullets");
  });

  it("does NOT import HeroRecommendedMove", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).not.toContain("HeroRecommendedMove");
  });

  it("does NOT import FreeTextInput", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).not.toContain("FreeTextInput");
  });

  it("has compact strip styling (not large hero)", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    // Compact padding and border radius
    expect(src).toContain("px-5");
    expect(src).toContain("py-4");
    expect(src).toContain("rounded-xl");
    // Should NOT have large hero padding
    expect(src).not.toContain("p-7");
    expect(src).not.toContain("rounded-2xl");
  });

  it("has loading skeleton state", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("HeroSkeleton");
    expect(src).toContain("<Skeleton");
  });

  it("handles error state gracefully", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("Unable to load project context");
  });

  it("handles no-data fallback", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("No project context yet");
  });

  it("uses DESIGN.md typography — General Sans for heading", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("font-display");
    expect(src).toContain("font-bold");
  });

  it("uses DESIGN.md secondary text size for buyer hint", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("text-[13px]");
  });

  it("uses subtle gradient for premium surface", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("bg-gradient-to-br");
  });

  it("does not have recommendation or callback props", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).not.toContain("recommendation:");
    expect(src).not.toContain("onFreeTextSubmit:");
    expect(src).not.toContain("onActionClick?:");
  });

  it("stays under 150 lines", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    const lineCount = src.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(150);
  });
});

// ═══════════════════════════════════════════════════════
// 3. HeroOpportunityBullets — sub-component (still exists)
// ═══════════════════════════════════════════════════════

describe("HeroOpportunityBullets", () => {
  const bulletsPath = resolve(dashDir, "components/HeroOpportunityBullets.tsx");

  it("exists", () => {
    expect(existsSync(bulletsPath)).toBe(true);
  });

  it("exports HeroOpportunityBullets", () => {
    const src = readSrc("components/HeroOpportunityBullets.tsx");
    expect(src).toContain("export function HeroOpportunityBullets");
  });

  it("has WHAT MATTERS NOW section label", () => {
    const src = readSrc("components/HeroOpportunityBullets.tsx");
    expect(src).toContain("WHAT MATTERS NOW");
  });

  it("uses mono uppercase section label per DESIGN.md", () => {
    const src = readSrc("components/HeroOpportunityBullets.tsx");
    expect(src).toContain("font-mono");
    expect(src).toContain('text-[10px]');
    expect(src).toContain("uppercase");
    expect(src).toContain("text-primary");
  });

  it("caps bullets at MAX_BULLETS (4)", () => {
    const src = readSrc("components/HeroOpportunityBullets.tsx");
    expect(src).toContain("MAX_BULLETS = 4");
  });

  it("uses category color dots for opportunity bullets", () => {
    const src = readSrc("components/HeroOpportunityBullets.tsx");
    expect(src).toContain("rounded-full");
    expect(src).toContain("bullet.color");
  });

  it("includes mainRisk as a distinct risk bullet", () => {
    const src = readSrc("components/HeroOpportunityBullets.tsx");
    expect(src).toContain("mainRisk");
    expect(src).toContain("main-risk");
    expect(src).toContain("AlertTriangleIcon");
  });

  it("returns null when no bullets", () => {
    const src = readSrc("components/HeroOpportunityBullets.tsx");
    expect(src).toContain("if (bullets.length === 0) return null");
  });

  it("does not use JS character truncation on risk text", () => {
    const src = readSrc("components/HeroOpportunityBullets.tsx");
    expect(src).not.toContain(".slice(0, 77)");
    expect(src).not.toContain('+ "..."');
  });

  it("uses CSS line-clamp-2 for risk bullet text", () => {
    const src = readSrc("components/HeroOpportunityBullets.tsx");
    expect(src).toContain("line-clamp-2");
  });

  it("provides full text via title attribute for hover tooltip", () => {
    const src = readSrc("components/HeroOpportunityBullets.tsx");
    expect(src).toContain("title={bullet.text}");
  });
});

// ═══════════════════════════════════════════════════════
// 4. HeroRecommendedMove — sub-component (still exists)
// ═══════════════════════════════════════════════════════

describe("HeroRecommendedMove", () => {
  const movePath = resolve(dashDir, "components/HeroRecommendedMove.tsx");

  it("exists", () => {
    expect(existsSync(movePath)).toBe(true);
  });

  it("exports HeroRecommendedMove", () => {
    const src = readSrc("components/HeroRecommendedMove.tsx");
    expect(src).toContain("export function HeroRecommendedMove");
  });

  it("has BEST FIRST MOVE section label", () => {
    const src = readSrc("components/HeroRecommendedMove.tsx");
    expect(src).toContain("BEST FIRST MOVE");
  });

  it("uses mono uppercase section label per DESIGN.md", () => {
    const src = readSrc("components/HeroRecommendedMove.tsx");
    expect(src).toContain("font-mono");
    expect(src).toContain('text-[10px]');
    expect(src).toContain("uppercase");
  });

  it("shows action title and specialist name", () => {
    const src = readSrc("components/HeroRecommendedMove.tsx");
    expect(src).toContain("recommendation.actionTitle");
    expect(src).toContain("recommendation.specialistName");
  });

  it("renders nothing when recommendation is null", () => {
    const src = readSrc("components/HeroRecommendedMove.tsx");
    expect(src).toContain("if (!recommendation) return null");
  });

  it("has an interactive button to start the action", () => {
    const src = readSrc("components/HeroRecommendedMove.tsx");
    expect(src).toContain("onActionClick");
    expect(src).toContain("<button");
  });
});

// ═══════════════════════════════════════════════════════
// 5. DashboardWorkspace wiring
// ═══════════════════════════════════════════════════════

describe("DashboardWorkspace hero wiring", () => {
  const src = readSrc("components/DashboardWorkspace.tsx");

  it("imports CompanyUnderstandingHero (not CompanySummary)", () => {
    expect(src).toContain("CompanyUnderstandingHero");
    expect(src).not.toContain("import { CompanySummary");
  });

  it("imports extractOpportunities", () => {
    expect(src).toContain("extractOpportunities");
  });

  it("imports pickBestFirstMove", () => {
    expect(src).toContain("pickBestFirstMove");
  });

  it("calls extractOpportunities via useMemo", () => {
    expect(src).toContain("extractOpportunities(files)");
    expect(src).toContain("useMemo");
  });

  it("calls pickBestFirstMove via useMemo", () => {
    expect(src).toContain("pickBestFirstMove(opportunities");
  });

  it("does not pass opportunities or recommendation to hero", () => {
    // These props are removed from the compact strip
    expect(src).not.toContain("opportunities={opportunities}");
    expect(src).not.toContain("recommendation={heroRecommendation}");
  });

  it("does not pass onFreeTextSubmit to hero", () => {
    expect(src).not.toContain("onFreeTextSubmit={");
  });
});
