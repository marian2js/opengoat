import assert from "node:assert/strict";
import test from "node:test";
import { getArtifactStatusConfig } from "./artifact-status-config.js";

// ---------------------------------------------------------------------------
// getArtifactStatusConfig – artifact status to label/className mapping
// ---------------------------------------------------------------------------

void test("getArtifactStatusConfig: maps 'draft' to 'DRAFT' label", () => {
  const config = getArtifactStatusConfig("draft");
  assert.equal(config.label, "DRAFT");
});

void test("getArtifactStatusConfig: maps 'ready_for_review' to 'READY FOR REVIEW' label", () => {
  const config = getArtifactStatusConfig("ready_for_review");
  assert.equal(config.label, "READY FOR REVIEW");
});

void test("getArtifactStatusConfig: maps 'approved' to 'APPROVED' label", () => {
  const config = getArtifactStatusConfig("approved");
  assert.equal(config.label, "APPROVED");
});

void test("getArtifactStatusConfig: maps 'needs_changes' to 'NEEDS CHANGES' label", () => {
  const config = getArtifactStatusConfig("needs_changes");
  assert.equal(config.label, "NEEDS CHANGES");
});

void test("getArtifactStatusConfig: maps 'archived' to 'ARCHIVED' label", () => {
  const config = getArtifactStatusConfig("archived");
  assert.equal(config.label, "ARCHIVED");
});

void test("getArtifactStatusConfig: returns unknown status as-is for unrecognized statuses", () => {
  const config = getArtifactStatusConfig("unknown_status");
  assert.equal(config.label, "unknown_status");
});

void test("getArtifactStatusConfig: each known status has non-empty className and dotClassName", () => {
  for (const status of ["draft", "ready_for_review", "approved", "needs_changes", "archived"]) {
    const config = getArtifactStatusConfig(status);
    assert.ok(typeof config.className === "string" && config.className.length > 0);
    assert.ok(typeof config.dotClassName === "string" && config.dotClassName.length > 0);
  }
});

void test("getArtifactStatusConfig: ready_for_review dot has animate-pulse", () => {
  const config = getArtifactStatusConfig("ready_for_review");
  assert.ok(config.dotClassName.includes("animate-pulse"));
});
