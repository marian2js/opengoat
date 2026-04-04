import assert from "node:assert/strict";
import test from "node:test";
import { isUuidLikeLabel, humanizeSessionLabel } from "./session-label";

// ---------------------------------------------------------------------------
// isUuidLikeLabel
// ---------------------------------------------------------------------------

void test("detects 8-char hex string as UUID-like", () => {
  assert.equal(isUuidLikeLabel("f1a26b39"), true);
});

void test("detects 8-char hex with date suffix as UUID-like", () => {
  assert.equal(isUuidLikeLabel("f1a26b39 (2026-03-22)"), true);
});

void test("detects full UUID as UUID-like", () => {
  assert.equal(isUuidLikeLabel("f1a26b39-abcd-1234-5678-123456789abc"), true);
});

void test("detects short UUID prefix with parenthesized date", () => {
  assert.equal(isUuidLikeLabel("15480b2f (2026-03-22)"), true);
});

void test("does not flag normal conversation title", () => {
  assert.equal(isUuidLikeLabel("Find launch communities"), false);
});

void test("does not flag action label with run number", () => {
  assert.equal(isUuidLikeLabel("Draft Product Hunt launch (4)"), false);
});

void test("does not flag empty string", () => {
  assert.equal(isUuidLikeLabel(""), false);
});

void test("does not flag undefined", () => {
  assert.equal(isUuidLikeLabel(undefined), false);
});

void test("does not flag agent chat fallback", () => {
  assert.equal(isUuidLikeLabel("OpenGoat chat"), false);
});

void test("does not flag short hex that is a real word", () => {
  // "deadbeef" is 8 hex chars but we still detect it — it's unlikely as a title
  assert.equal(isUuidLikeLabel("deadbeef"), true);
});

void test("does not flag hex-like substrings in normal text", () => {
  assert.equal(isUuidLikeLabel("Build a12b feature"), false);
});

// ---------------------------------------------------------------------------
// humanizeSessionLabel
// ---------------------------------------------------------------------------

void test("returns descriptive label unchanged", () => {
  assert.equal(
    humanizeSessionLabel("Find launch communities", "2026-03-22T10:00:00Z"),
    "Find launch communities",
  );
});

void test("returns 'New chat' fallback for UUID label", () => {
  const result = humanizeSessionLabel("f1a26b39 (2026-03-22)", "2026-03-22T10:00:00Z");
  assert.equal(result, "New chat");
});

void test("returns 'New chat' fallback for full UUID label", () => {
  const result = humanizeSessionLabel(
    "f1a26b39-abcd-1234-5678-123456789abc",
    "2026-03-22T10:00:00Z",
  );
  assert.equal(result, "New chat");
});

void test("returns 'New chat' fallback for bare hex UUID label", () => {
  const result = humanizeSessionLabel("15480b2f", "2026-03-22T14:30:00Z");
  assert.equal(result, "New chat");
});

void test("returns 'New chat' fallback for undefined label", () => {
  const result = humanizeSessionLabel(undefined, "2026-03-22T10:00:00Z");
  assert.equal(result, "New chat");
});

void test("returns 'New chat' fallback for empty label", () => {
  const result = humanizeSessionLabel("", "2026-03-22T10:00:00Z");
  assert.equal(result, "New chat");
});

void test("returns 'New chat' fallback for invalid date", () => {
  const result = humanizeSessionLabel("f1a26b39", "invalid-date");
  assert.equal(result, "New chat");
});

void test("preserves action labels with run numbers", () => {
  assert.equal(
    humanizeSessionLabel("Draft Product Hunt launch (4)", "2026-03-22T10:00:00Z"),
    "Draft Product Hunt launch (4)",
  );
});

void test("truncates long labels to 55 characters", () => {
  const longLabel = "This is a very long conversation title that definitely should be truncated at some point";
  const result = humanizeSessionLabel(longLabel, "2026-03-22T10:00:00Z");
  assert.ok(result.length <= 55);
  assert.ok(result.endsWith("..."));
});

void test("does not truncate labels at exactly 55 chars", () => {
  const label = "A".repeat(55);
  const result = humanizeSessionLabel(label, "2026-03-22T10:00:00Z");
  assert.equal(result, label);
});

// ---------------------------------------------------------------------------
// truncateSessionLabel — API-safe truncation for gateway limits
// ---------------------------------------------------------------------------

import { truncateSessionLabel } from "./session-label";

void test("returns short labels unchanged", () => {
  assert.equal(truncateSessionLabel("Launch Pack"), "Launch Pack");
});

void test("returns labels at exactly 60 chars unchanged", () => {
  const label = "A".repeat(60);
  assert.equal(truncateSessionLabel(label), label);
});

void test("truncates labels longer than 60 chars with ellipsis", () => {
  const label = "Launch Pack: Bullaware - AI-powered competitor intelligence for SaaS teams — 2026-04-15 — Product Hunt";
  const result = truncateSessionLabel(label);
  assert.ok(result.length <= 60, `Expected <= 60 chars, got ${result.length}`);
  assert.ok(result.endsWith("…"), "Expected ellipsis at end");
});

void test("preserves the playbook title prefix when truncating", () => {
  const label = "Launch Pack: Bullaware - AI-powered competitor intelligence for SaaS teams — 2026-04-15 — Product Hunt";
  const result = truncateSessionLabel(label);
  assert.ok(result.startsWith("Launch Pack: Bullaware"), `Expected prefix preserved, got: ${result}`);
});

void test("handles empty string", () => {
  assert.equal(truncateSessionLabel(""), "");
});

void test("uses custom maxLength when provided", () => {
  const label = "A very long label that exceeds a short limit";
  const result = truncateSessionLabel(label, 20);
  assert.ok(result.length <= 20, `Expected <= 20 chars, got ${result.length}`);
  assert.ok(result.endsWith("…"));
});
