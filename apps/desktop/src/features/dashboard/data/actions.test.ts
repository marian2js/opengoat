import assert from "node:assert/strict";
import test from "node:test";
import {
  starterActions,
  categoryConfig,
  type ActionCategory,
} from "./actions";

void test("starterActions has exactly 13 cards", () => {
  assert.equal(
    starterActions.length,
    13,
    `Expected 13 cards, got ${starterActions.length}`,
  );
});

void test("every card has required fields", () => {
  for (const card of starterActions) {
    assert.ok(card.id, `Card missing id`);
    assert.ok(card.title, `Card ${card.id} missing title`);
    assert.ok(card.promise, `Card ${card.id} missing promise`);
    assert.ok(card.description, `Card ${card.id} missing description`);
    assert.ok(card.icon, `Card ${card.id} missing icon`);
    assert.ok(card.category, `Card ${card.id} missing category`);
    assert.ok(card.prompt, `Card ${card.id} missing prompt`);
    assert.ok(
      Array.isArray(card.skills) && card.skills.length > 0,
      `Card ${card.id} must have a non-empty skills array`,
    );
  }
});

void test("all card ids are unique", () => {
  const ids = starterActions.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "Duplicate card ids found");
});

void test("all card categories are valid", () => {
  const validCategories: ActionCategory[] = [
    "conversion",
    "distribution",
    "growth",
    "messaging",
    "research",
    "seo",
  ];
  for (const card of starterActions) {
    assert.ok(
      validCategories.includes(card.category),
      `Card ${card.id} has invalid category: ${card.category}`,
    );
  }
});

void test("category distribution matches spec §5.3", () => {
  const counts = new Map<ActionCategory, number>();
  for (const card of starterActions) {
    counts.set(card.category, (counts.get(card.category) ?? 0) + 1);
  }
  assert.equal(counts.get("distribution"), 4, "distribution should have 4 cards");
  assert.equal(counts.get("messaging"), 2, "messaging should have 2 cards");
  assert.equal(counts.get("conversion"), 2, "conversion should have 2 cards");
  assert.equal(counts.get("seo"), 2, "seo should have 2 cards");
  assert.equal(counts.get("research"), 2, "research should have 2 cards");
  assert.equal(counts.get("growth"), 1, "growth should have 1 card");
});

void test("distribution is the most common category", () => {
  const counts = new Map<ActionCategory, number>();
  for (const card of starterActions) {
    counts.set(card.category, (counts.get(card.category) ?? 0) + 1);
  }
  const distCount = counts.get("distribution") ?? 0;
  for (const [cat, count] of counts) {
    if (cat !== "distribution") {
      assert.ok(
        distCount >= count,
        `distribution (${distCount}) should have at least as many cards as ${cat} (${count})`,
      );
    }
  }
});

void test("no slop actions — titles imply concrete results", () => {
  const slopPatterns = [
    /^improve\s/i,
    /^build\s+strategy/i,
    /^prepare\s+launch$/i,
    /^increase\s/i,
    /^optimize\s+funnel/i,
    /^create\s+.*\s+plan$/i,
  ];
  for (const card of starterActions) {
    for (const pattern of slopPatterns) {
      assert.ok(
        !pattern.test(card.title),
        `Card "${card.title}" matches slop pattern ${pattern}`,
      );
    }
  }
});

void test("no card prompt contains old inline preamble patterns", () => {
  const oldPatterns = [
    /^You are an expert/m,
    /^Read the workspace context files/m,
  ];
  for (const card of starterActions) {
    for (const pattern of oldPatterns) {
      assert.ok(
        !pattern.test(card.prompt),
        `Card ${card.id} prompt still contains old inline pattern: ${pattern}`,
      );
    }
  }
});

void test("skill-to-action mapping matches spec §14", () => {
  const expectedSkills: Record<string, string[]> = {
    "find-launch-communities": ["launch-strategy", "marketing-ideas"],
    "draft-product-hunt-launch": ["launch-strategy"],
    "find-subreddits": ["marketing-ideas"],
    "plan-social-content-calendar": ["social-content", "content-strategy"],
    "rewrite-homepage-hero": ["copywriting", "page-cro"],
    "draft-cold-email-sequence": ["cold-email", "email-sequence"],
    "audit-landing-page-conversions": ["page-cro"],
    "optimize-signup-flow": ["signup-flow-cro", "onboarding-cro"],
    "run-seo-audit": ["seo-audit", "schema-markup"],
    "plan-content-strategy": ["content-strategy", "ai-seo"],
    "analyze-competitor-messaging": ["competitor-alternatives", "marketing-psychology"],
    "evaluate-pricing-strategy": ["pricing-strategy"],
    "generate-content-ideas": ["content-strategy", "marketing-ideas"],
  };

  for (const [cardId, skills] of Object.entries(expectedSkills)) {
    const card = starterActions.find((c) => c.id === cardId);
    assert.ok(card, `Card ${cardId} should exist`);
    assert.deepEqual(
      card.skills,
      skills,
      `Card ${cardId} should have skills ${JSON.stringify(skills)}, got ${JSON.stringify(card.skills)}`,
    );
  }
});

void test("persona-to-action mapping matches spec §14", () => {
  const expectedPersonas: Record<string, string | undefined> = {
    "find-launch-communities": "growth-hacker",
    "draft-product-hunt-launch": "growth-hacker",
    "find-subreddits": "reddit-community-builder",
    "plan-social-content-calendar": "social-media-strategist",
    "rewrite-homepage-hero": "brand-guardian",
    "draft-cold-email-sequence": "outbound-strategist",
    "audit-landing-page-conversions": "ux-researcher",
    "optimize-signup-flow": "ux-researcher",
    "run-seo-audit": "seo-specialist",
    "plan-content-strategy": "seo-specialist",
    "analyze-competitor-messaging": "brand-guardian",
    "evaluate-pricing-strategy": undefined,
    "generate-content-ideas": "content-creator",
  };

  for (const [cardId, persona] of Object.entries(expectedPersonas)) {
    const card = starterActions.find((c) => c.id === cardId);
    assert.ok(card, `Card ${cardId} should exist`);
    assert.equal(
      card.persona,
      persona,
      `Card ${cardId} should have persona ${persona}, got ${card.persona}`,
    );
  }
});

void test("evaluate-pricing-strategy is the only card without a persona", () => {
  const cardsWithoutPersona = starterActions.filter((c) => !c.persona);
  assert.equal(
    cardsWithoutPersona.length,
    1,
    `Expected exactly 1 card without persona, got ${cardsWithoutPersona.length}`,
  );
  assert.equal(
    cardsWithoutPersona[0].id,
    "evaluate-pricing-strategy",
    "The card without persona should be evaluate-pricing-strategy",
  );
});

void test("generate-content-ideas is in the growth category", () => {
  const card = starterActions.find((c) => c.id === "generate-content-ideas");
  assert.ok(card, "Should have a generate-content-ideas card");
  assert.equal(card.category, "growth");
  assert.equal(card.title, "Generate content ideas");
});

void test("categoryConfig has an entry for every ActionCategory", () => {
  const categories: ActionCategory[] = [
    "conversion",
    "distribution",
    "growth",
    "messaging",
    "research",
    "seo",
  ];
  for (const cat of categories) {
    assert.ok(categoryConfig[cat], `Missing config for category: ${cat}`);
    assert.ok(categoryConfig[cat].label, `Missing label for category: ${cat}`);
    assert.ok(
      categoryConfig[cat].className,
      `Missing className for category: ${cat}`,
    );
  }
});
