import assert from "node:assert/strict";
import test from "node:test";
import {
  truncateLabel,
  formatCountBadge,
} from "./row-badges-helpers.js";

// ---------------------------------------------------------------------------
// ObjectiveChip truncation helper
// ---------------------------------------------------------------------------

void test("truncateLabel: returns label as-is when within maxLen", () => {
  assert.equal(truncateLabel("Short", 18), "Short");
});

void test("truncateLabel: truncates and appends ellipsis when over maxLen", () => {
  const long = "Launch on Product Hunt next week";
  const result = truncateLabel(long, 18);
  assert.ok(result.length <= 19); // 18 + ellipsis char
  assert.ok(result.endsWith("…"));
});

void test("truncateLabel: handles empty string", () => {
  assert.equal(truncateLabel("", 18), "");
});

void test("truncateLabel: handles exact maxLen", () => {
  const exact = "Exactly18Charssss!";
  assert.equal(truncateLabel(exact, 18), exact);
});

// ---------------------------------------------------------------------------
// Count badge formatting
// ---------------------------------------------------------------------------

void test("formatCountBadge: returns null for zero count", () => {
  assert.equal(formatCountBadge(0), null);
});

void test("formatCountBadge: returns string for positive count", () => {
  assert.equal(formatCountBadge(3), "3");
});

void test("formatCountBadge: returns 99+ for large numbers", () => {
  assert.equal(formatCountBadge(100), "99+");
  assert.equal(formatCountBadge(150), "99+");
});

void test("formatCountBadge: returns string for single digit", () => {
  assert.equal(formatCountBadge(1), "1");
});
