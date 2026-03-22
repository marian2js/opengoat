import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "OpportunityCard.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Text density: description must be visually subordinate to title
// ---------------------------------------------------------------------------

void test("OpportunityCard description uses opacity to subordinate text", () => {
  // The description <p> should have reduced opacity to be lighter than the title
  const pMatch = src.match(/<p[^>]*className="([^"]*)"/);
  assert.ok(pMatch, "Expected to find a <p> element with a className");
  const className = pMatch[1];
  assert.ok(
    className.includes("opacity-80"),
    `Expected description to have 'opacity-80' for visual subordination, got: ${className}`,
  );
});

void test("OpportunityCard description has line-clamp-2 for consistent clamping", () => {
  const pMatch = src.match(/<p[^>]*className="([^"]*)"/);
  assert.ok(pMatch, "Expected to find a <p> element with a className");
  const className = pMatch[1];
  assert.ok(
    className.includes("line-clamp-2"),
    `Expected description to have 'line-clamp-2', got: ${className}`,
  );
});

void test("OpportunityCard description has left border accent for visual separation", () => {
  const pMatch = src.match(/<p[^>]*className="([^"]*)"/);
  assert.ok(pMatch, "Expected to find a <p> element with a className");
  const className = pMatch[1];
  assert.ok(
    className.includes("border-l-2") && className.includes("pl-2"),
    `Expected description to have 'border-l-2' and 'pl-2' for left accent, got: ${className}`,
  );
});

void test("OpportunityCard has spacing between title row and description", () => {
  // The card uses flex-col with gap — check that gap provides separation
  // OR the description has mt-1 for additional spacing
  const containerMatch = src.match(/className="[^"]*flex flex-col[^"]*gap-(\d+)/);
  const pMatch = src.match(/<p[^>]*className="([^"]*)"/);
  assert.ok(pMatch, "Expected to find a <p> element with a className");
  const hasGap = containerMatch !== null;
  const hasMt = pMatch[1].includes("mt-");
  assert.ok(
    hasGap || hasMt,
    "Expected spacing between title and description via flex gap or margin-top",
  );
});

void test("OpportunityCard CTA button uses font-semibold for prominence", () => {
  // Action buttons should use font-semibold to stand out as the primary action
  const buttonMatches = src.match(/<button[^>]*className="([^"]*)"/g);
  assert.ok(buttonMatches, "Expected to find button elements");
  for (const match of buttonMatches) {
    const className = match.match(/className="([^"]*)"/)?.[1] ?? "";
    assert.ok(
      className.includes("font-semibold"),
      `Expected CTA button to have 'font-semibold', got: ${className}`,
    );
  }
});

void test("OpportunityCard description uses text-xs for smaller size", () => {
  const pMatch = src.match(/<p[^>]*className="([^"]*)"/);
  assert.ok(pMatch, "Expected to find a <p> element with a className");
  const className = pMatch[1];
  assert.ok(
    className.includes("text-xs"),
    `Expected description to use 'text-xs' for smaller size, got: ${className}`,
  );
});
