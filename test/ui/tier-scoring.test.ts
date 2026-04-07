import { describe, expect, it } from "vitest";
import { groupAndRankJobs, type JobTier, type TieredJobs } from "../../apps/desktop/src/features/dashboard/lib/tier-scoring";

function job(id: string, tier?: JobTier) {
  return { id, tier };
}

describe("groupAndRankJobs", () => {
  // ── Tier assignment from metadata ──

  it("places a hero-tagged job in the hero slot", () => {
    const result = groupAndRankJobs([
      job("a", "hero"),
      job("b", "primary"),
      job("c", "primary"),
      job("d", "secondary"),
    ]);
    expect(result.hero?.id).toBe("a");
  });

  it("places primary-tagged jobs in the primary array", () => {
    const result = groupAndRankJobs([
      job("a", "hero"),
      job("b", "primary"),
      job("c", "primary"),
      job("d", "secondary"),
    ]);
    expect(result.primary.map((j) => j.id)).toContain("b");
    expect(result.primary.map((j) => j.id)).toContain("c");
  });

  it("places secondary-tagged jobs in the secondary array", () => {
    const result = groupAndRankJobs([
      job("a", "hero"),
      job("b", "primary"),
      job("c", "primary"),
      job("d", "secondary"),
    ]);
    expect(result.secondary.map((j) => j.id)).toContain("d");
  });

  it("treats jobs without a tier field as secondary", () => {
    const result = groupAndRankJobs([
      job("a", "hero"),
      job("b", "primary"),
      job("c", "primary"),
      job("d"), // no tier
    ]);
    expect(result.secondary.map((j) => j.id)).toContain("d");
  });

  // ── Hero selection ──

  it("demotes extra hero-tagged jobs to primary when multiple heroes exist", () => {
    const result = groupAndRankJobs([
      job("a", "hero"),
      job("b", "hero"),
      job("c", "primary"),
      job("d", "secondary"),
    ]);
    expect(result.hero?.id).toBe("a");
    expect(result.primary.map((j) => j.id)).toContain("b");
  });

  it("promotes first primary job to hero when no hero-tagged job exists", () => {
    const result = groupAndRankJobs([
      job("a", "primary"),
      job("b", "primary"),
      job("c", "secondary"),
    ]);
    expect(result.hero?.id).toBe("a");
    // "a" was promoted out of primary, so primary should have "b"
    expect(result.primary.map((j) => j.id)).not.toContain("a");
    expect(result.primary.map((j) => j.id)).toContain("b");
  });

  // ── Primary count enforcement ──

  it("demotes excess primary jobs to secondary when more than 4", () => {
    const result = groupAndRankJobs([
      job("h", "hero"),
      job("a", "primary"),
      job("b", "primary"),
      job("c", "primary"),
      job("d", "primary"),
      job("e", "primary"), // 5th primary — should be demoted
    ]);
    expect(result.primary).toHaveLength(4);
    expect(result.secondary.map((j) => j.id)).toContain("e");
  });

  it("promotes from secondary to fill primary when fewer than 2 primaries", () => {
    const result = groupAndRankJobs([
      job("h", "hero"),
      job("a", "primary"), // only 1 primary
      job("b", "secondary"),
      job("c", "secondary"),
    ]);
    expect(result.primary.length).toBeGreaterThanOrEqual(2);
    expect(result.primary.map((j) => j.id)).toContain("b");
  });

  // ── Edge cases ──

  it("returns null hero when no jobs are provided", () => {
    const result = groupAndRankJobs([]);
    expect(result.hero).toBeNull();
    expect(result.primary).toHaveLength(0);
    expect(result.secondary).toHaveLength(0);
  });

  it("handles a single job (becomes hero)", () => {
    const result = groupAndRankJobs([job("a", "primary")]);
    expect(result.hero?.id).toBe("a");
    expect(result.primary).toHaveLength(0);
    expect(result.secondary).toHaveLength(0);
  });

  it("preserves original order within each tier", () => {
    const result = groupAndRankJobs([
      job("h", "hero"),
      job("p1", "primary"),
      job("p2", "primary"),
      job("p3", "primary"),
      job("s1", "secondary"),
      job("s2", "secondary"),
    ]);
    expect(result.primary.map((j) => j.id)).toEqual(["p1", "p2", "p3"]);
    expect(result.secondary.map((j) => j.id)).toEqual(["s1", "s2"]);
  });
});

// ── Starter action tier assignments ──
describe("starter action tier assignments", () => {
  // This test imports actual starter actions to verify they have correct tiers
  it("outside-in discovery actions are tagged as primary", async () => {
    const { starterActions } = await import("../../apps/desktop/src/features/dashboard/data/actions");
    const seoAction = starterActions.find((a) => a.id === "find-seo-quick-wins");
    const comparisonAction = starterActions.find((a) => a.id === "create-comparison-page-outline");
    const contentAction = starterActions.find((a) => a.id === "generate-founder-content-ideas");

    expect(seoAction?.tier).toBe("primary");
    expect(comparisonAction?.tier).toBe("primary");
    expect(contentAction?.tier).toBe("primary");
  });

  it("packaging/rewrite actions are tagged as secondary", async () => {
    const { starterActions } = await import("../../apps/desktop/src/features/dashboard/data/actions");
    const phAction = starterActions.find((a) => a.id === "launch-product-hunt");
    const heroAction = starterActions.find((a) => a.id === "rewrite-homepage-hero");
    const conversionAction = starterActions.find((a) => a.id === "improve-homepage-conversion");
    const outboundAction = starterActions.find((a) => a.id === "build-outbound-sequence");
    const leadAction = starterActions.find((a) => a.id === "create-lead-magnet-ideas");

    expect(phAction?.tier).toBe("secondary");
    expect(heroAction?.tier).toBe("secondary");
    expect(conversionAction?.tier).toBe("secondary");
    expect(outboundAction?.tier).toBe("secondary");
    expect(leadAction?.tier).toBe("secondary");
  });
});
