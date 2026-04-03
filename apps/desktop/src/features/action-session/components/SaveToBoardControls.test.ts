import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "SaveToBoardControls.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// SaveToBoardControls: renders all outputs as checked checkboxes by default
// ---------------------------------------------------------------------------

void test("SaveToBoardControls initialises selectedIds with all output ids", () => {
  // The component creates a Set from every output id in the initial state
  assert.ok(
    src.includes('new Set(outputs.map((o) => o.id))'),
    "Expected initial selectedIds to contain all output ids",
  );
});

void test("SaveToBoardControls renders a checkbox for each output", () => {
  assert.ok(
    src.includes("outputs.map((output)"),
    "Expected outputs.map to render each output",
  );
  assert.ok(
    src.includes('type="checkbox"'),
    "Expected checkbox input for each output",
  );
  assert.ok(
    src.includes("checked={selectedIds.has(output.id)}"),
    "Expected checkbox checked state tied to selectedIds",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: toggling a checkbox removes/adds it from selection
// ---------------------------------------------------------------------------

void test("SaveToBoardControls toggleOutput adds and removes ids", () => {
  assert.ok(
    src.includes("function toggleOutput(id: string)"),
    "Expected toggleOutput function",
  );
  assert.ok(
    src.includes("next.delete(id)"),
    "Expected toggling off to delete from set",
  );
  assert.ok(
    src.includes("next.add(id)"),
    "Expected toggling on to add to set",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: Save to Board calls createRun then createTaskFromRun
// ---------------------------------------------------------------------------

void test("SaveToBoardControls handleSave calls createRun first", () => {
  assert.ok(
    src.includes("await client.createRun("),
    "Expected createRun call during save",
  );
});

void test("SaveToBoardControls handleSave calls createTaskFromRun for each selected output", () => {
  assert.ok(
    src.includes("for (const output of selected)"),
    "Expected loop over selected outputs",
  );
  assert.ok(
    src.includes("await client.createTaskFromRun("),
    "Expected createTaskFromRun call inside loop",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: createTaskFromRun receives agentId as actorId
// ---------------------------------------------------------------------------

void test("SaveToBoardControls passes agentId as actorId to createTaskFromRun", () => {
  assert.ok(
    src.includes("}, agentId)"),
    "Expected agentId passed as second arg (actorId) to createTaskFromRun",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: only selected outputs get saved
// ---------------------------------------------------------------------------

void test("SaveToBoardControls filters to selected outputs before saving", () => {
  assert.ok(
    src.includes("outputs.filter((o) => selectedIds.has(o.id))"),
    "Expected filtering outputs by selectedIds",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: shows loading spinner while saving
// ---------------------------------------------------------------------------

void test("SaveToBoardControls shows a loading spinner when isSaving", () => {
  assert.ok(
    src.includes("LoaderCircleIcon"),
    "Expected LoaderCircleIcon import for loading state",
  );
  assert.ok(
    src.includes("animate-spin"),
    "Expected spin animation class on loader",
  );
  assert.ok(
    src.includes("isSaving ?"),
    "Expected conditional rendering based on isSaving",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: button is disabled when saving
// ---------------------------------------------------------------------------

void test("SaveToBoardControls disables button while saving", () => {
  assert.ok(
    src.includes("disabled={isSaving || selectedIds.size === 0}"),
    "Expected disabled when isSaving or no selection",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: button is disabled when no outputs selected
// ---------------------------------------------------------------------------

void test("SaveToBoardControls disables button when no outputs selected", () => {
  assert.ok(
    src.includes("selectedIds.size === 0"),
    "Expected disabled when selectedIds is empty",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: shows error message when createRun fails
// ---------------------------------------------------------------------------

void test("SaveToBoardControls shows error message on failure", () => {
  assert.ok(
    src.includes("setError(err instanceof Error ? err.message"),
    "Expected error message to be set from caught error",
  );
  assert.ok(
    src.includes("AlertCircleIcon"),
    "Expected AlertCircleIcon for error display",
  );
  assert.ok(
    src.includes("{error}"),
    "Expected error text rendered in the UI",
  );
});

void test("SaveToBoardControls catches errors with try/catch", () => {
  assert.ok(
    src.includes("} catch (err)"),
    "Expected try/catch around save logic",
  );
  assert.ok(
    src.includes('"Failed to save to board. Please try again."'),
    "Expected fallback error message",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: Skip button calls onSkip
// ---------------------------------------------------------------------------

void test("SaveToBoardControls skip button calls onSkip", () => {
  assert.ok(
    src.includes("onClick={onSkip}"),
    "Expected onClick bound to onSkip prop",
  );
  assert.ok(
    src.includes("Skip"),
    "Expected skip button label text",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: onSaved is called after successful save
// ---------------------------------------------------------------------------

void test("SaveToBoardControls calls onSaved after successful save", () => {
  assert.ok(
    src.includes("onSaved()"),
    "Expected onSaved() called after createTaskFromRun loop completes",
  );
});

// ---------------------------------------------------------------------------
// SaveToBoardControls: isSaving is reset in finally block
// ---------------------------------------------------------------------------

void test("SaveToBoardControls resets isSaving in finally block", () => {
  assert.ok(
    src.includes("} finally {"),
    "Expected finally block",
  );
  assert.ok(
    src.includes("setIsSaving(false)"),
    "Expected setIsSaving(false) in finally",
  );
});
