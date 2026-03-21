import assert from "node:assert/strict";
import test from "node:test";
import {
  starterActions,
  categoryConfig,
  type ActionCategory,
} from "./actions";

void test("starterActions has 6-8 cards", () => {
  assert.ok(
    starterActions.length >= 6 && starterActions.length <= 8,
    `Expected 6-8 cards, got ${starterActions.length}`,
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
  }
});

void test("all card ids are unique", () => {
  const ids = starterActions.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "Duplicate card ids found");
});

void test("all card categories are valid", () => {
  const validCategories: ActionCategory[] = [
    "distribution",
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

void test("starter set satisfies spec §15.4 — at least 1 messaging", () => {
  const messaging = starterActions.filter((c) => c.category === "messaging");
  assert.ok(messaging.length >= 1, "Need at least 1 messaging action");
});

void test("starter set satisfies spec §15.4 — at least 1 research", () => {
  const research = starterActions.filter((c) => c.category === "research");
  assert.ok(research.length >= 1, "Need at least 1 research action");
});

void test("starter set satisfies spec §15.4 — at least 1 SEO", () => {
  const seo = starterActions.filter((c) => c.category === "seo");
  assert.ok(seo.length >= 1, "Need at least 1 SEO action");
});

void test("starter set satisfies spec §15.4 — more than 1 distribution", () => {
  const distribution = starterActions.filter(
    (c) => c.category === "distribution",
  );
  assert.ok(
    distribution.length > 1,
    `Need more than 1 distribution action, got ${distribution.length}`,
  );
});

void test("distribution is the most common category (weighted toward distribution)", () => {
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

void test("every prompt references workspace context files", () => {
  const contextFiles = ["PRODUCT.md", "MARKET.md", "GROWTH.md"];
  for (const card of starterActions) {
    for (const file of contextFiles) {
      assert.ok(
        card.prompt.includes(file),
        `Card ${card.id} prompt should reference ${file}`,
      );
    }
  }
});

void test("generate-content-ideas action card exists with correct properties", () => {
  const card = starterActions.find((c) => c.id === "generate-content-ideas");
  assert.ok(card, "Should have a generate-content-ideas card");
  assert.equal(card.category, "messaging");
  assert.equal(card.title, "Generate content ideas");
  assert.ok(
    card.prompt.includes("content"),
    "Prompt should reference content",
  );
});

void test("categoryConfig has an entry for every ActionCategory", () => {
  const categories: ActionCategory[] = [
    "distribution",
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
