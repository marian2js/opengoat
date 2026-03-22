import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "OpportunityCard.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// CTA prominence: action buttons must have visible background/border treatment
// ---------------------------------------------------------------------------

void test("CTA action button has a visible border treatment (not text-only)", () => {
  // The CTA button for the related action should have a border class
  // Find the button that contains relatedAction.title
  const actionBtnMatch = src.match(
    /<button[^>]*className="([^"]*)"[^>]*>[^]*?relatedAction\.title/,
  );
  assert.ok(actionBtnMatch, "Expected to find a CTA button with relatedAction.title");
  const className = actionBtnMatch[1];
  assert.ok(
    className.includes("border"),
    `Expected CTA button to have a border class for prominence, got: ${className}`,
  );
});

void test("CTA action button has a background treatment", () => {
  const actionBtnMatch = src.match(
    /<button[^>]*className="([^"]*)"[^>]*>[^]*?relatedAction\.title/,
  );
  assert.ok(actionBtnMatch, "Expected to find a CTA button with relatedAction.title");
  const className = actionBtnMatch[1];
  assert.ok(
    className.includes("bg-"),
    `Expected CTA button to have a background class, got: ${className}`,
  );
});

void test("CTA action button uses font-semibold for prominence", () => {
  const actionBtnMatch = src.match(
    /<button[^>]*className="([^"]*)"[^>]*>[^]*?relatedAction\.title/,
  );
  assert.ok(actionBtnMatch, "Expected to find a CTA button with relatedAction.title");
  const className = actionBtnMatch[1];
  assert.ok(
    className.includes("font-semibold"),
    `Expected CTA button to use font-semibold, got: ${className}`,
  );
});

void test("CTA action button has rounded styling for pill/button appearance", () => {
  const actionBtnMatch = src.match(
    /<button[^>]*className="([^"]*)"[^>]*>[^]*?relatedAction\.title/,
  );
  assert.ok(actionBtnMatch, "Expected to find a CTA button with relatedAction.title");
  const className = actionBtnMatch[1];
  assert.ok(
    className.includes("rounded"),
    `Expected CTA button to have rounded corners, got: ${className}`,
  );
});

void test("CTA arrow icon uses size-3.5 for better visibility", () => {
  // The ArrowRightIcon in the action CTA should use size-3.5, not size-3
  const arrowMatches = [...src.matchAll(/ArrowRightIcon[^/]*className="([^"]*)"/g)];
  assert.ok(arrowMatches.length > 0, "Expected to find ArrowRightIcon elements");
  // At least the main action CTA arrow should be size-3.5
  const hasLargerArrow = arrowMatches.some((m) => m[1].includes("size-3.5"));
  assert.ok(
    hasLargerArrow,
    `Expected at least one ArrowRightIcon to use size-3.5 for better visibility`,
  );
});

void test("CTA action button has padding for button-like appearance", () => {
  const actionBtnMatch = src.match(
    /<button[^>]*className="([^"]*)"[^>]*>[^]*?relatedAction\.title/,
  );
  assert.ok(actionBtnMatch, "Expected to find a CTA button with relatedAction.title");
  const className = actionBtnMatch[1];
  assert.ok(
    className.includes("px-") && className.includes("py-"),
    `Expected CTA button to have horizontal and vertical padding, got: ${className}`,
  );
});

void test("View results button also has visible background/border treatment", () => {
  // The "View results" button should also be styled with prominence
  const viewBtnMatch = src.match(
    /<button[^>]*className="([^"]*)"[^>]*>[^]*?View results/,
  );
  assert.ok(viewBtnMatch, "Expected to find a View results button");
  const className = viewBtnMatch[1];
  assert.ok(
    className.includes("border") && className.includes("bg-"),
    `Expected View results button to have border and background, got: ${className}`,
  );
});

void test("CTA hover state includes background change for clear feedback", () => {
  const actionBtnMatch = src.match(
    /<button[^>]*className="([^"]*)"[^>]*>[^]*?relatedAction\.title/,
  );
  assert.ok(actionBtnMatch, "Expected to find a CTA button with relatedAction.title");
  const className = actionBtnMatch[1];
  assert.ok(
    className.includes("hover:bg-"),
    `Expected CTA button to have hover:bg- for interactive feedback, got: ${className}`,
  );
});
