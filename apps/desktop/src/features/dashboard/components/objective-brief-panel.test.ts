import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ObjectiveBriefPanel.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// ObjectiveBriefPanel — design system and structure validation
// ---------------------------------------------------------------------------

void test("ObjectiveBriefPanel: has loading state with spinner and skeletons", () => {
  assert.ok(
    src.includes("Generating brief..."),
    "Expected loading message",
  );
  assert.ok(
    src.includes("animate-spin"),
    "Expected spinning loader animation",
  );
  assert.ok(
    src.includes("Skeleton"),
    "Expected skeleton loading placeholders",
  );
});

void test("ObjectiveBriefPanel: has error state with fallback action", () => {
  assert.ok(
    src.includes("Brief generation failed"),
    "Expected error message",
  );
  assert.ok(
    src.includes("Continue without brief"),
    "Expected fallback action on error",
  );
});

void test("ObjectiveBriefPanel: shows Brief Summary section", () => {
  assert.ok(
    src.includes("Brief Summary"),
    "Expected 'Brief Summary' heading in brief display",
  );
});

void test("ObjectiveBriefPanel: renders constraints section", () => {
  assert.ok(
    src.includes("Constraints") && src.includes("constraints"),
    "Expected constraints section",
  );
});

void test("ObjectiveBriefPanel: renders suggested playbooks section", () => {
  assert.ok(
    src.includes("Suggested Playbooks") && src.includes("suggestedPlaybooks"),
    "Expected suggested playbooks section",
  );
});

void test("ObjectiveBriefPanel: renders missing information section", () => {
  assert.ok(
    src.includes("Missing Information") && src.includes("missingInfo"),
    "Expected missing information section",
  );
});

void test("ObjectiveBriefPanel: renders likely deliverables section", () => {
  assert.ok(
    src.includes("Likely Deliverables") && src.includes("likelyDeliverables"),
    "Expected likely deliverables section",
  );
});

void test("ObjectiveBriefPanel: has Accept, Edit, and Skip actions", () => {
  assert.ok(src.includes("Accept brief"), "Expected 'Accept brief' action");
  assert.ok(src.includes("Edit"), "Expected 'Edit' action");
  assert.ok(src.includes("Skip"), "Expected 'Skip' action");
});

void test("ObjectiveBriefPanel: uses mono uppercase labels for sections", () => {
  assert.ok(
    src.includes("font-mono") && src.includes("uppercase") && src.includes("tracking-wider"),
    "Expected mono uppercase section labels following design system",
  );
});

void test("ObjectiveBriefPanel: uses primary color for summary heading", () => {
  assert.ok(
    src.includes("text-primary"),
    "Expected primary (teal) color for summary heading",
  );
});
