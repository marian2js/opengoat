import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ProjectSettings.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: Clicking Save shows a visible success toast confirming the save
// ---------------------------------------------------------------------------

void test("handleSaveGeneral calls toast.success on successful save", () => {
  assert.ok(
    src.includes("toast.success"),
    "Save handler must call toast.success() to show a success notification",
  );
});

void test("Success toast message indicates settings were saved", () => {
  assert.ok(
    src.includes('toast.success("Settings saved'),
    "Success toast must display 'Settings saved' message",
  );
});

// ---------------------------------------------------------------------------
// AC2: The toast auto-dismisses (Sonner default is ~4s, acceptable)
// ---------------------------------------------------------------------------

void test("Uses sonner toast which auto-dismisses by default", () => {
  assert.ok(
    src.includes('from "sonner"'),
    "Must import toast from sonner which provides auto-dismiss behavior",
  );
});

// ---------------------------------------------------------------------------
// AC3: If the save fails, an error toast appears instead
// ---------------------------------------------------------------------------

void test("handleSaveGeneral calls toast.error on failed save", () => {
  assert.ok(
    src.includes("toast.error") && src.includes("Failed to save"),
    "Save handler must call toast.error() with a failure message on error",
  );
});

// ---------------------------------------------------------------------------
// AC4: No inline saveMessage display — replaced by toast
// ---------------------------------------------------------------------------

void test("No inline saveMessage state for General save feedback", () => {
  assert.ok(
    !src.includes("setSaveMessage"),
    "Inline saveMessage state must be removed — feedback is via toast now",
  );
});

void test("No inline save message div rendering", () => {
  assert.ok(
    !src.includes("saveMessage.type"),
    "Inline saveMessage rendering must be removed — feedback is via toast now",
  );
});

// ---------------------------------------------------------------------------
// AC5: Toast styling matches app's design language (uses existing Sonner config)
// ---------------------------------------------------------------------------

void test("Uses the existing Sonner toast infrastructure (not a custom component)", () => {
  const toastImport = src.includes('import { toast } from "sonner"');
  assert.ok(
    toastImport,
    "Must use the existing sonner toast import for consistent styling",
  );
});

// ---------------------------------------------------------------------------
// AC6: No console errors — clean imports
// ---------------------------------------------------------------------------

void test("CheckIcon import is removed if no longer used inline", () => {
  // CheckIcon was only used in the inline saveMessage success indicator.
  // If saveMessage is removed, CheckIcon should also be removed (unless used elsewhere).
  const checkIconUsages = src.match(/CheckIcon/g);
  // If CheckIcon is still imported, it must be used somewhere in JSX
  if (checkIconUsages) {
    const inJsx = src.includes("<CheckIcon");
    assert.ok(
      inJsx,
      "If CheckIcon is imported, it must be used in JSX — otherwise remove the unused import",
    );
  }
});
