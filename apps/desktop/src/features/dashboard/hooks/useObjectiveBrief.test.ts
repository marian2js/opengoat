import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "useObjectiveBrief.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// useObjectiveBrief hook structure tests
// ---------------------------------------------------------------------------

void test("useObjectiveBrief: exports a named function", () => {
  assert.ok(
    src.includes("export function useObjectiveBrief"),
    "Expected named export 'useObjectiveBrief'",
  );
});

void test("useObjectiveBrief: uses collectStreamText for SSE parsing", () => {
  assert.ok(
    src.includes("collectStreamText"),
    "Expected collectStreamText for SSE stream parsing",
  );
});

void test("useObjectiveBrief: creates internal session for AI generation", () => {
  assert.ok(
    src.includes("createSession") && src.includes("internal"),
    "Expected internal session creation for AI brief generation",
  );
});

void test("useObjectiveBrief: sends chat message with brief prompt", () => {
  assert.ok(
    src.includes("sendChatMessage"),
    "Expected sendChatMessage call for brief generation",
  );
});

void test("useObjectiveBrief: returns brief, isGenerating, and error", () => {
  assert.ok(src.includes("brief"), "Expected 'brief' in return");
  assert.ok(src.includes("isGenerating"), "Expected 'isGenerating' in return");
  assert.ok(src.includes("error"), "Expected 'error' in return");
});

void test("useObjectiveBrief: parses JSON response for brief structure", () => {
  assert.ok(
    src.includes("JSON.parse"),
    "Expected JSON parsing of AI response",
  );
});

void test("useObjectiveBrief: handles generation errors gracefully", () => {
  assert.ok(
    src.includes("catch"),
    "Expected error handling for generation failures",
  );
});
