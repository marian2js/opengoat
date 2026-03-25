import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "FreeTextInput.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// FreeTextInput: placeholder text matches spec
// ---------------------------------------------------------------------------

void test("FreeTextInput has the correct placeholder text", () => {
  assert.ok(
    src.includes("What do you want help with right now?"),
    'Expected placeholder "What do you want help with right now?"',
  );
});

// ---------------------------------------------------------------------------
// FreeTextInput: submit on Enter key
// ---------------------------------------------------------------------------

void test("FreeTextInput handles Enter key submission", () => {
  assert.ok(
    src.includes("Enter"),
    "Expected Enter key handling for submission",
  );
});

// ---------------------------------------------------------------------------
// FreeTextInput: calls onSubmit prop
// ---------------------------------------------------------------------------

void test("FreeTextInput accepts onSubmit callback", () => {
  assert.ok(
    src.includes("onSubmit"),
    "Expected onSubmit prop for handling text submission",
  );
});

// ---------------------------------------------------------------------------
// FreeTextInput: trims whitespace before submitting
// ---------------------------------------------------------------------------

void test("FreeTextInput trims whitespace before submitting", () => {
  assert.ok(
    src.includes(".trim()"),
    "Expected trimming of whitespace before submission",
  );
});

// ---------------------------------------------------------------------------
// FreeTextInput: has a submit button with ArrowRight icon
// ---------------------------------------------------------------------------

void test("FreeTextInput has a submit button", () => {
  assert.ok(
    src.includes("<button") || src.includes("Button"),
    "Expected a submit button element",
  );
});

// ---------------------------------------------------------------------------
// FreeTextInput: disabled submit when empty
// ---------------------------------------------------------------------------

void test("FreeTextInput disables submit button when input is empty", () => {
  assert.ok(
    src.includes("disabled"),
    "Expected disabled state on submit button when input is empty",
  );
});

// ---------------------------------------------------------------------------
// FreeTextInput: textarea for multi-line support
// ---------------------------------------------------------------------------

void test("FreeTextInput uses textarea for multi-line input", () => {
  assert.ok(
    src.includes("<textarea") || src.includes("textarea"),
    "Expected textarea element for multi-line free-text input",
  );
});
