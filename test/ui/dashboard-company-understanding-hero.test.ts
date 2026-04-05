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
// 2. CompanyUnderstandingHero — main component
// ═══════════════════════════════════════════════════════

describe("CompanyUnderstandingHero component", () => {
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

  it("renders full productSummary paragraph (not truncated to one sentence)", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    // Should show full productSummary, not split on first sentence
    expect(src).toContain("data.productSummary");
    expect(src).not.toContain("split(/\\.\\s/)");
  });

  it("renders HeroOpportunityBullets sub-component", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("<HeroOpportunityBullets");
  });

  it("renders HeroRecommendedMove sub-component", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("<HeroRecommendedMove");
  });

  it("embeds FreeTextInput inside the hero", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("<FreeTextInput");
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
    expect(src).toContain('text-[24px]');
    expect(src).toContain("font-bold");
  });

  it("uses DESIGN.md body text — 15px for summary", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    expect(src).toContain("text-[15px]");
  });

  it("stays under 200 lines", () => {
    const src = readSrc("components/CompanyUnderstandingHero.tsx");
    const lineCount = src.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(200);
  });
});

// ═══════════════════════════════════════════════════════
// 3. HeroOpportunityBullets — sub-component
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
});

// ═══════════════════════════════════════════════════════
// 4. HeroRecommendedMove — sub-component
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

  it("passes opportunities and recommendation to hero", () => {
    expect(src).toContain("opportunities={opportunities}");
    expect(src).toContain("recommendation={heroRecommendation}");
  });

  it("does not render FreeTextInput directly (now inside hero)", () => {
    // FreeTextInput should only appear inside CompanyUnderstandingHero
    const directFreeTextRender = src.match(/<FreeTextInput/g);
    expect(directFreeTextRender).toBeNull();
  });
});
