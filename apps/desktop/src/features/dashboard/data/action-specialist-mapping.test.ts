import assert from "node:assert/strict";
import test from "node:test";
import { starterActions } from "./actions";

/**
 * Specialist mapping — every starter action must be attributed to a specialist agent.
 * Mapping defined in task 0004 research notes.
 */

const SPECIALIST_MAPPING: Record<string, string> = {
  "launch-product-hunt": "distribution",
  "rewrite-homepage-hero": "website-conversion",
  "improve-homepage-conversion": "website-conversion",
  "build-outbound-sequence": "outbound",
  "find-seo-quick-wins": "seo-aeo",
  "create-comparison-page-outline": "seo-aeo",
  "generate-founder-content-ideas": "content",
  "create-lead-magnet-ideas": "content",
};

void test("every starterAction has a specialistId", () => {
  for (const card of starterActions) {
    assert.ok(
      card.specialistId,
      `Card "${card.id}" is missing specialistId`,
    );
  }
});

void test("specialistId mapping matches the spec", () => {
  for (const [cardId, expectedSpecialistId] of Object.entries(SPECIALIST_MAPPING)) {
    const card = starterActions.find((c) => c.id === cardId);
    assert.ok(card, `Card "${cardId}" should exist`);
    assert.equal(
      card.specialistId,
      expectedSpecialistId,
      `Card "${cardId}" should map to specialist "${expectedSpecialistId}", got "${card.specialistId}"`,
    );
  }
});

void test("all specialistId values are valid specialist IDs", () => {
  const validIds = new Set([
    "cmo",
    "market-intel",
    "positioning",
    "website-conversion",
    "seo-aeo",
    "distribution",
    "content",
    "outbound",
  ]);
  for (const card of starterActions) {
    if (card.specialistId) {
      assert.ok(
        validIds.has(card.specialistId),
        `Card "${card.id}" has invalid specialistId: "${card.specialistId}"`,
      );
    }
  }
});
