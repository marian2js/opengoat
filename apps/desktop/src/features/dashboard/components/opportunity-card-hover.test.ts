import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "OpportunityCard.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Hover & interactivity: insight cards must feel clickable like action cards
// ---------------------------------------------------------------------------

void test("OpportunityCard container has hover:border transition", () => {
  assert.ok(
    src.includes("hover:border-primary"),
    "Expected hover:border-primary* on the card container for visible border change on hover",
  );
});

void test("OpportunityCard container has hover:bg transition", () => {
  assert.ok(
    src.includes("hover:bg-card"),
    "Expected hover:bg-card* on the card container for visible background change on hover",
  );
});

void test("OpportunityCard container has cursor-pointer", () => {
  assert.ok(
    src.includes("cursor-pointer"),
    "Expected cursor-pointer on the card container to indicate interactivity",
  );
});

void test("OpportunityCard container has smooth transition (duration-150)", () => {
  assert.ok(
    src.includes("transition-all") && src.includes("duration-150"),
    "Expected transition-all and duration-150 for smooth hover transitions",
  );
});

void test("OpportunityCard action link uses text-xs (not text-[11px])", () => {
  // The action link buttons should use text-xs for readability
  // There should be no text-[11px] remaining on action links
  const actionLinkMatches = src.match(/className="[^"]*text-\[11px\][^"]*"/g);
  assert.equal(
    actionLinkMatches,
    null,
    `Expected no text-[11px] on action links (should be text-xs), found: ${actionLinkMatches?.join(", ")}`,
  );
});

void test("OpportunityCard card container is clickable (has onClick handler)", () => {
  // The outer card/div should have an onClick handler to make the entire card clickable
  // Look for onClick on the container div (not just on buttons inside)
  const containerMatch = src.match(/<div[^>]*onClick/);
  assert.ok(
    containerMatch,
    "Expected onClick handler on the card container div to make the entire card clickable",
  );
});

void test("OpportunityCard uses group class for child hover effects", () => {
  assert.ok(
    src.includes("group/insight"),
    "Expected group/insight class on the card container for coordinated child hover effects",
  );
});
