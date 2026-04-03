import assert from "node:assert/strict";
import test from "node:test";
import { stripMarkdown } from "./strip-markdown.js";

void test("stripMarkdown: removes heading markers", () => {
  assert.equal(stripMarkdown("## 1. Tagline Variants"), "1. Tagline Variants");
  assert.equal(stripMarkdown("# Title"), "Title");
  assert.equal(stripMarkdown("### Sub heading"), "Sub heading");
  assert.equal(stripMarkdown("###### Deep heading"), "Deep heading");
});

void test("stripMarkdown: removes bold markers", () => {
  assert.equal(
    stripMarkdown("**Deeper eToro research before you copy**"),
    "Deeper eToro research before you copy",
  );
  assert.equal(stripMarkdown("__also bold__"), "also bold");
});

void test("stripMarkdown: removes italic markers", () => {
  assert.equal(stripMarkdown("*italic text*"), "italic text");
  assert.equal(stripMarkdown("_also italic_"), "also italic");
});

void test("stripMarkdown: removes strikethrough markers", () => {
  assert.equal(stripMarkdown("~~deleted~~"), "deleted");
});

void test("stripMarkdown: removes inline code markers", () => {
  assert.equal(stripMarkdown("`code snippet`"), "code snippet");
});

void test("stripMarkdown: removes unordered list markers", () => {
  assert.equal(stripMarkdown("- Confidence: high"), "Confidence: high");
  assert.equal(stripMarkdown("* bullet item"), "bullet item");
  assert.equal(stripMarkdown("+ plus item"), "plus item");
});

void test("stripMarkdown: removes ordered list markers", () => {
  assert.equal(stripMarkdown("1. First item"), "First item");
  assert.equal(stripMarkdown("42. Forty-second item"), "Forty-second item");
});

void test("stripMarkdown: extracts link text from markdown links", () => {
  assert.equal(
    stripMarkdown("[click here](https://example.com)"),
    "click here",
  );
});

void test("stripMarkdown: collapses newlines and whitespace", () => {
  assert.equal(stripMarkdown("line one\n\nline two"), "line one line two");
  assert.equal(stripMarkdown("too   many   spaces"), "too many spaces");
});

void test("stripMarkdown: handles combined markdown in one string", () => {
  assert.equal(
    stripMarkdown("## 1. Tagline Variants 1. **Deeper eToro research before you copy** - Confidence: **high**"),
    "1. Tagline Variants 1. Deeper eToro research before you copy - Confidence: high",
  );
});

void test("stripMarkdown: returns empty string for empty input", () => {
  assert.equal(stripMarkdown(""), "");
});

void test("stripMarkdown: returns plain text unchanged", () => {
  assert.equal(stripMarkdown("just plain text"), "just plain text");
});
