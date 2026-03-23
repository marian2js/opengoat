import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ObjectiveComposerPrompt.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// ObjectiveComposerPrompt — design system and structure validation
// ---------------------------------------------------------------------------

void test("ObjectiveComposerPrompt: uses section-label pattern with teal icon", () => {
  assert.ok(
    src.includes("section-label"),
    "Expected section-label CSS class",
  );
  assert.ok(
    src.includes("text-primary"),
    "Expected teal primary color on icon",
  );
});

void test("ObjectiveComposerPrompt: shows hero question with display font", () => {
  assert.ok(
    src.includes("What are you trying to achieve right now?"),
    "Expected hero prompt question",
  );
  assert.ok(
    src.includes("font-display"),
    "Expected Satoshi display font on hero heading",
  );
});

void test("ObjectiveComposerPrompt: has 8 goal type buttons", () => {
  const goalTypes = [
    "Launch",
    "Improve conversion",
    "Start outbound",
    "Build SEO",
    "Content sprint",
    "Comparison pages",
    "Lead magnet",
    "Onboarding",
  ];
  for (const gt of goalTypes) {
    assert.ok(src.includes(gt), `Expected goal type button: ${gt}`);
  }
});

void test("ObjectiveComposerPrompt: goal buttons have teal hover state", () => {
  assert.ok(
    src.includes("hover:border-primary") || src.includes("group-hover/goal:text-primary"),
    "Expected teal hover accent on goal type buttons",
  );
});

void test("ObjectiveComposerPrompt: has free-text input with placeholder", () => {
  assert.ok(
    src.includes("Or describe your goal..."),
    "Expected free-text input placeholder",
  );
});

void test("ObjectiveComposerPrompt: has Create objective submit button", () => {
  assert.ok(
    src.includes("Create objective"),
    "Expected 'Create objective' submit button label",
  );
});

void test("ObjectiveComposerPrompt: renders goal buttons in responsive grid", () => {
  assert.ok(
    src.includes("grid-cols-2") && src.includes("sm:grid-cols-4"),
    "Expected responsive 2-col / 4-col grid for goal types",
  );
});

void test("ObjectiveComposerPrompt: handles Enter key on free-text input", () => {
  assert.ok(
    src.includes("onKeyDown") && src.includes("Enter"),
    "Expected Enter key handling for free-text submission",
  );
});

void test("ObjectiveComposerPrompt: calls onCreateObjective with prefilled title on goal click", () => {
  assert.ok(
    src.includes("onCreateObjective") && src.includes("prefillTitle"),
    "Expected onCreateObjective callback with prefill from goal type",
  );
});
