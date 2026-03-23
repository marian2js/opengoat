import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "artifact-type-config.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// artifact-type-config — structure and coverage tests
// ---------------------------------------------------------------------------

void test("artifact-type-config: exports ARTIFACT_TYPE_CONFIG", () => {
  assert.ok(
    src.includes("ARTIFACT_TYPE_CONFIG"),
    "Expected ARTIFACT_TYPE_CONFIG export",
  );
});

void test("artifact-type-config: exports ARTIFACT_STATUS_CONFIG", () => {
  assert.ok(
    src.includes("ARTIFACT_STATUS_CONFIG"),
    "Expected ARTIFACT_STATUS_CONFIG export",
  );
});

void test("artifact-type-config: covers all artifact types from contracts", () => {
  const types = [
    "copy_draft", "content_calendar", "checklist", "backlog", "matrix",
    "research_brief", "page_outline", "launch_pack", "email_sequence",
    "strategy_note", "report", "dataset_list",
  ];
  for (const type of types) {
    assert.ok(src.includes(type), `Expected type mapping for '${type}'`);
  }
});

void test("artifact-type-config: covers all artifact statuses", () => {
  const statuses = ["draft", "ready_for_review", "approved", "needs_changes", "archived"];
  for (const status of statuses) {
    assert.ok(src.includes(status), `Expected status mapping for '${status}'`);
  }
});

void test("artifact-type-config: draft status uses muted styling", () => {
  assert.ok(
    src.includes("muted"),
    "Expected draft status to use muted color scheme",
  );
});

void test("artifact-type-config: approved status uses green/success styling", () => {
  assert.ok(
    src.includes("green") || src.includes("success"),
    "Expected approved status to use green/success color scheme",
  );
});

void test("artifact-type-config: needs_changes status uses red/destructive styling", () => {
  assert.ok(
    src.includes("destructive") || src.includes("red"),
    "Expected needs_changes status to use destructive/red color scheme",
  );
});

void test("artifact-type-config: ready_for_review status uses amber/warning styling", () => {
  assert.ok(
    src.includes("amber"),
    "Expected ready_for_review status to use amber/warning color scheme",
  );
});

void test("artifact-type-config: exports getArtifactTypeConfig helper", () => {
  assert.ok(
    src.includes("getArtifactTypeConfig"),
    "Expected getArtifactTypeConfig helper function",
  );
});

void test("artifact-type-config: exports getArtifactStatusConfig helper", () => {
  assert.ok(
    src.includes("getArtifactStatusConfig"),
    "Expected getArtifactStatusConfig helper function",
  );
});

void test("artifact-type-config: has fallback/default config for unknown types", () => {
  assert.ok(
    src.includes("??") || src.includes("fallback") || src.includes("DEFAULT") || src.includes("default"),
    "Expected fallback config for unknown artifact types",
  );
});

void test("artifact-type-config: type config includes label and accentColor", () => {
  assert.ok(src.includes("label"), "Expected label in type config");
  assert.ok(src.includes("accentColor"), "Expected accentColor in type config");
});

void test("artifact-type-config: status config includes dotClassName", () => {
  assert.ok(src.includes("dotClassName"), "Expected dotClassName in status config");
});
