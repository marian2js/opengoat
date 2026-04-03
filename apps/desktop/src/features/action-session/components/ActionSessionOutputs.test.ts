import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ActionSessionOutputs.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// ActionSessionOutputs: returns null when outputs array is empty
// ---------------------------------------------------------------------------

void test("ActionSessionOutputs returns null for empty outputs", () => {
  assert.ok(
    src.includes("if (outputs.length === 0) return null"),
    "Expected early return of null when outputs is empty",
  );
});

// ---------------------------------------------------------------------------
// ActionSessionOutputs: renders output count badge
// ---------------------------------------------------------------------------

void test("ActionSessionOutputs renders output count badge", () => {
  assert.ok(
    src.includes("{outputs.length}"),
    "Expected outputs.length rendered as count badge",
  );
  assert.ok(
    src.includes("tabular-nums"),
    "Expected tabular-nums class for monospaced count",
  );
});

// ---------------------------------------------------------------------------
// ActionSessionOutputs: renders each output card with title
// ---------------------------------------------------------------------------

void test("ActionSessionOutputs maps outputs to OutputCard components", () => {
  assert.ok(
    src.includes("outputs.map((output)"),
    "Expected outputs.map to render cards",
  );
  assert.ok(
    src.includes("<OutputCard"),
    "Expected OutputCard component used for each output",
  );
  assert.ok(
    src.includes("key={output.id}"),
    "Expected output.id as key for each card",
  );
});

void test("OutputCard renders the output title", () => {
  assert.ok(
    src.includes("{output.title}"),
    "Expected output.title rendered in the card heading",
  );
});

// ---------------------------------------------------------------------------
// ActionSessionOutputs: copy button copies full content to clipboard
// ---------------------------------------------------------------------------

void test("OutputCard copy button writes full content to clipboard", () => {
  assert.ok(
    src.includes("navigator.clipboard.writeText(output.content)"),
    "Expected clipboard.writeText called with output.content",
  );
  assert.ok(
    src.includes("handleCopy"),
    "Expected handleCopy function for copy action",
  );
});

void test("OutputCard shows check icon after copy", () => {
  assert.ok(
    src.includes("setCopied(true)"),
    "Expected copied state set to true after copy",
  );
  assert.ok(
    src.includes("setCopied(false)"),
    "Expected copied state reset after timeout",
  );
  assert.ok(
    src.includes("CheckIcon"),
    "Expected CheckIcon shown when copied",
  );
  assert.ok(
    src.includes("CopyIcon"),
    "Expected CopyIcon shown when not copied",
  );
});

// ---------------------------------------------------------------------------
// ActionSessionOutputs: full markdown content is always passed to Streamdown
// ---------------------------------------------------------------------------

void test("OutputCard passes full content to Streamdown (never truncated)", () => {
  assert.ok(
    src.includes("<RenderedMarkdown content={output.content} />"),
    "Expected full output.content passed to RenderedMarkdown",
  );
  // The component clips visually with CSS maxHeight, not by truncating content
  assert.ok(
    src.includes("maxHeight: COLLAPSED_MAX_HEIGHT"),
    "Expected visual clipping via maxHeight style, not content truncation",
  );
});

void test("RenderedMarkdown passes content to Streamdown children", () => {
  assert.ok(
    src.includes("{content}"),
    "Expected content passed as Streamdown children",
  );
  assert.ok(
    src.includes("<Streamdown"),
    "Expected Streamdown component used for rendering",
  );
});

// ---------------------------------------------------------------------------
// ActionSessionOutputs: show more/less toggle works for long content
// ---------------------------------------------------------------------------

void test("OutputCard detects overflow and shows show-more toggle", () => {
  assert.ok(
    src.includes("setIsOverflowing(el.scrollHeight > COLLAPSED_MAX_HEIGHT)"),
    "Expected overflow detection based on scrollHeight vs COLLAPSED_MAX_HEIGHT",
  );
  assert.ok(
    src.includes("COLLAPSED_MAX_HEIGHT = 320"),
    "Expected COLLAPSED_MAX_HEIGHT constant of 320",
  );
});

void test("OutputCard toggles expanded state on button click", () => {
  assert.ok(
    src.includes("onClick={() => setExpanded(!expanded)}"),
    "Expected toggle of expanded state",
  );
  assert.ok(
    src.includes("Show more"),
    "Expected 'Show more' label when collapsed",
  );
  assert.ok(
    src.includes("Show less"),
    "Expected 'Show less' label when expanded",
  );
});

void test("OutputCard shows chevron icons for expand/collapse", () => {
  assert.ok(
    src.includes("ChevronDownIcon"),
    "Expected ChevronDownIcon for show more",
  );
  assert.ok(
    src.includes("ChevronUpIcon"),
    "Expected ChevronUpIcon for show less",
  );
});

void test("OutputCard shows fade gradient when collapsed and overflowing", () => {
  assert.ok(
    src.includes("!expanded && isOverflowing"),
    "Expected gradient shown only when collapsed and overflowing",
  );
  assert.ok(
    src.includes("bg-gradient-to-t"),
    "Expected gradient class for fade-out effect",
  );
});
