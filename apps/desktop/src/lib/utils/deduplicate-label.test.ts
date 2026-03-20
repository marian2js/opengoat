import assert from "node:assert/strict";
import test from "node:test";
import { deduplicateLabel } from "./deduplicate-label";

void test("returns base label when no sessions exist", () => {
  assert.equal(deduplicateLabel("Find launch communities", []), "Find launch communities");
});

void test("returns base label when no conflict", () => {
  const sessions = [{ label: "Other session" }, { label: "Another session" }];
  assert.equal(deduplicateLabel("Find launch communities", sessions), "Find launch communities");
});

void test("returns (2) when base label exists", () => {
  const sessions = [{ label: "Find launch communities" }];
  assert.equal(deduplicateLabel("Find launch communities", sessions), "Find launch communities (2)");
});

void test("returns (3) when base and (2) exist", () => {
  const sessions = [
    { label: "Find launch communities" },
    { label: "Find launch communities (2)" },
  ];
  assert.equal(deduplicateLabel("Find launch communities", sessions), "Find launch communities (3)");
});

void test("returns (4) when base, (2), and (3) exist", () => {
  const sessions = [
    { label: "Find launch communities" },
    { label: "Find launch communities (2)" },
    { label: "Find launch communities (3)" },
  ];
  assert.equal(deduplicateLabel("Find launch communities", sessions), "Find launch communities (4)");
});

void test("handles gap in numbering — picks max + 1", () => {
  const sessions = [
    { label: "Find launch communities" },
    { label: "Find launch communities (5)" },
  ];
  assert.equal(deduplicateLabel("Find launch communities", sessions), "Find launch communities (6)");
});

void test("does not confuse similar labels", () => {
  const sessions = [
    { label: "Find launch" },
    { label: "Find launch communities nearby" },
  ];
  assert.equal(deduplicateLabel("Find launch communities", sessions), "Find launch communities");
});

void test("handles sessions with undefined labels", () => {
  const sessions = [{ label: undefined }, { label: "Find launch communities" }];
  assert.equal(deduplicateLabel("Find launch communities", sessions), "Find launch communities (2)");
});

void test("handles labels with regex special characters", () => {
  const sessions = [{ label: "Test (special) label?" }];
  assert.equal(deduplicateLabel("Test (special) label?", sessions), "Test (special) label? (2)");
});
