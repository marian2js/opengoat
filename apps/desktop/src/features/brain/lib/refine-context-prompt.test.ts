import assert from "node:assert/strict";
import test from "node:test";
import {
  isRefinableSection,
  buildRefineContextPrompt,
  buildRefineContextLabel,
  buildRefineContextActionId,
} from "./refine-context-prompt";

// ---------------------------------------------------------------------------
// isRefinableSection
// ---------------------------------------------------------------------------

void test("isRefinableSection: returns true for product, market, growth", () => {
  assert.equal(isRefinableSection("product"), true);
  assert.equal(isRefinableSection("market"), true);
  assert.equal(isRefinableSection("growth"), true);
});

void test("isRefinableSection: returns false for memory and knowledge", () => {
  assert.equal(isRefinableSection("memory"), false);
  assert.equal(isRefinableSection("knowledge"), false);
});

void test("isRefinableSection: returns false for unknown sections", () => {
  assert.equal(isRefinableSection("anything-else"), false);
  assert.equal(isRefinableSection(""), false);
});

// ---------------------------------------------------------------------------
// buildRefineContextPrompt
// ---------------------------------------------------------------------------

void test("buildRefineContextPrompt: references the skill file path (read-on-demand)", () => {
  const prompt = buildRefineContextPrompt("product");
  assert.ok(
    prompt.includes("./skills/marketing/product-marketing-context/SKILL.md"),
    "Should reference the skill file path",
  );
});

void test("buildRefineContextPrompt: does NOT inline skill content", () => {
  const prompt = buildRefineContextPrompt("product");
  // The prompt should be short — just instructions to read files, not the skill itself
  assert.ok(prompt.length < 500, `Prompt should be concise, got ${prompt.length} chars`);
});

void test("buildRefineContextPrompt: references all three context files", () => {
  const prompt = buildRefineContextPrompt("market");
  assert.ok(prompt.includes("PRODUCT.md"), "Should reference PRODUCT.md");
  assert.ok(prompt.includes("MARKET.md"), "Should reference MARKET.md");
  assert.ok(prompt.includes("GROWTH.md"), "Should reference GROWTH.md");
});

void test("buildRefineContextPrompt: emphasizes the clicked section", () => {
  const productPrompt = buildRefineContextPrompt("product");
  assert.ok(
    productPrompt.includes("Focus especially on the Product context"),
    "Should emphasize Product when sectionId is product",
  );

  const marketPrompt = buildRefineContextPrompt("market");
  assert.ok(
    marketPrompt.includes("Focus especially on the Market context"),
    "Should emphasize Market when sectionId is market",
  );

  const growthPrompt = buildRefineContextPrompt("growth");
  assert.ok(
    growthPrompt.includes("Focus especially on the Growth context"),
    "Should emphasize Growth when sectionId is growth",
  );
});

void test("buildRefineContextPrompt: instructs conversational gap-filling", () => {
  const prompt = buildRefineContextPrompt("product");
  assert.ok(
    prompt.includes("Walk me through filling the gaps conversationally"),
    "Should include conversational instruction",
  );
  assert.ok(
    prompt.includes("one question at a time"),
    "Should ask one question at a time",
  );
});

// ---------------------------------------------------------------------------
// buildRefineContextLabel
// ---------------------------------------------------------------------------

void test("buildRefineContextLabel: returns descriptive session label", () => {
  assert.equal(buildRefineContextLabel("product"), "Refine product context");
  assert.equal(buildRefineContextLabel("market"), "Refine market context");
  assert.equal(buildRefineContextLabel("growth"), "Refine growth context");
});

// ---------------------------------------------------------------------------
// buildRefineContextActionId
// ---------------------------------------------------------------------------

void test("buildRefineContextActionId: returns section-specific action id", () => {
  assert.equal(buildRefineContextActionId("product"), "refine-product-context");
  assert.equal(buildRefineContextActionId("market"), "refine-market-context");
  assert.equal(buildRefineContextActionId("growth"), "refine-growth-context");
});
