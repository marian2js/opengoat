import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ObjectiveCreationSheet.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// ObjectiveCreationSheet — design system and structure validation
// ---------------------------------------------------------------------------

void test("ObjectiveCreationSheet: uses Sheet component from UI library", () => {
  assert.ok(
    src.includes("Sheet") && src.includes("SheetContent"),
    "Expected Sheet and SheetContent from UI library",
  );
});

void test("ObjectiveCreationSheet: slides from right side", () => {
  assert.ok(
    src.includes('side="right"'),
    "Expected Sheet to slide from right side",
  );
});

void test("ObjectiveCreationSheet: has wider max-width (sm:max-w-md)", () => {
  assert.ok(
    src.includes("sm:max-w-md"),
    "Expected wider max-width override for creation sheet",
  );
});

void test("ObjectiveCreationSheet: has Create objective title with display font", () => {
  assert.ok(
    src.includes("Create objective"),
    "Expected 'Create objective' title",
  );
  assert.ok(
    src.includes("font-display"),
    "Expected Satoshi display font on sheet title",
  );
});

void test("ObjectiveCreationSheet: shows title field as required", () => {
  assert.ok(
    src.includes("What do you want help with?"),
    "Expected title field label",
  );
  assert.ok(
    src.includes("*"),
    "Expected required asterisk on title field",
  );
});

void test("ObjectiveCreationSheet: shows success definition field in fast-start mode", () => {
  assert.ok(
    src.includes("What does success look like?"),
    "Expected success definition field in fast-start mode",
  );
});

void test("ObjectiveCreationSheet: has toggle to show all fields", () => {
  assert.ok(
    src.includes("Show all fields"),
    "Expected 'Show all fields' toggle link",
  );
  assert.ok(
    src.includes("Hide extra fields"),
    "Expected 'Hide extra fields' toggle link",
  );
});

void test("ObjectiveCreationSheet: full form has all spec fields", () => {
  assert.ok(src.includes("alreadyTried"), "Expected 'already tried' field");
  assert.ok(src.includes("avoid"), "Expected 'avoid' field");
  assert.ok(src.includes("timeframe"), "Expected 'timeframe' field");
  assert.ok(src.includes("preferredChannels"), "Expected 'channel preferences' field");
  assert.ok(src.includes("notes"), "Expected 'notes' field");
});

void test("ObjectiveCreationSheet: form labels use mono uppercase styling", () => {
  assert.ok(
    src.includes("font-mono") && src.includes("uppercase") && src.includes("tracking-wider"),
    "Expected mono uppercase label styling per design system",
  );
});

void test("ObjectiveCreationSheet: has Create draft objective submit button", () => {
  assert.ok(
    src.includes("Create draft objective"),
    "Expected 'Create draft objective' submit button",
  );
});

void test("ObjectiveCreationSheet: shows spinner when submitting", () => {
  assert.ok(
    src.includes("animate-spin") && src.includes("Creating..."),
    "Expected loading spinner and text during submission",
  );
});

void test("ObjectiveCreationSheet: transitions to brief phase after creation", () => {
  assert.ok(
    src.includes("brief") && src.includes("ObjectiveBriefPanel"),
    "Expected transition to ObjectiveBriefPanel after creation",
  );
});

void test("ObjectiveCreationSheet: brief phase has Accept, Edit, Skip actions via BriefPanel", () => {
  assert.ok(
    src.includes("handleAcceptBrief") && src.includes("handleEditBrief") && src.includes("handleSkipBrief"),
    "Expected Accept, Edit, Skip brief handlers",
  );
});

void test("ObjectiveCreationSheet: uses useObjectiveCreation and useObjectiveBrief hooks", () => {
  assert.ok(
    src.includes("useObjectiveCreation") && src.includes("useObjectiveBrief"),
    "Expected both creation and brief hooks",
  );
});

void test("ObjectiveCreationSheet: supports prefillTitle from composer prompt", () => {
  assert.ok(
    src.includes("prefillTitle"),
    "Expected prefillTitle prop for pre-filling from goal type buttons",
  );
});
