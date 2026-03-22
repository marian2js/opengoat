import assert from "node:assert/strict";
import test from "node:test";
import { FILTER_OPTIONS, SORT_OPTIONS } from "./board-filters.js";

// ---------------------------------------------------------------------------
// FILTER_OPTIONS tests
// ---------------------------------------------------------------------------

void test("FILTER_OPTIONS: has 5 filter options", () => {
  assert.equal(FILTER_OPTIONS.length, 5);
});

void test("FILTER_OPTIONS: includes all expected filter values", () => {
  const values = FILTER_OPTIONS.map((o) => o.value);
  assert.deepEqual(values, ["all", "open", "blocked", "pending", "done"]);
});

void test("FILTER_OPTIONS: each option has a non-empty label", () => {
  for (const option of FILTER_OPTIONS) {
    assert.ok(option.label.length > 0, `Filter "${option.value}" should have a label`);
  }
});

// ---------------------------------------------------------------------------
// SORT_OPTIONS tests
// ---------------------------------------------------------------------------

void test("SORT_OPTIONS: has 4 sort options", () => {
  assert.equal(SORT_OPTIONS.length, 4);
});

void test("SORT_OPTIONS: includes all expected sort values", () => {
  const values = SORT_OPTIONS.map((o) => o.value);
  assert.deepEqual(values, ["updated", "status", "newest", "oldest"]);
});

void test("SORT_OPTIONS: each option has a non-empty label", () => {
  for (const option of SORT_OPTIONS) {
    assert.ok(option.label.length > 0, `Sort "${option.value}" should have a label`);
  }
});

void test("SORT_OPTIONS: default sort 'updated' has label 'Most Recently Updated'", () => {
  const updated = SORT_OPTIONS.find((o) => o.value === "updated");
  assert.ok(updated);
  assert.equal(updated.label, "Most Recently Updated");
});
