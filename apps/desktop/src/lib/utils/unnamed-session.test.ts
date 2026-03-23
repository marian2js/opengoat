import assert from "node:assert/strict";
import test from "node:test";
import { isUnnamedSession } from "./unnamed-session";

void test("returns true for undefined", () => {
  assert.equal(isUnnamedSession(undefined), true);
});

void test("returns true for empty string", () => {
  assert.equal(isUnnamedSession(""), true);
});

void test("returns true for 'new conversation'", () => {
  assert.equal(isUnnamedSession("new conversation"), true);
});

void test("returns true for 'Untitled chat' (case-insensitive)", () => {
  assert.equal(isUnnamedSession("Untitled chat"), true);
});

void test("returns true for 'untitled'", () => {
  assert.equal(isUnnamedSession("untitled"), true);
});

void test("returns true for UUID-like label", () => {
  assert.equal(isUnnamedSession("f1a26b39 (2026-03-22)"), true);
});

void test("returns true for bare 8-char hex", () => {
  assert.equal(isUnnamedSession("15480b2f"), true);
});

void test("returns true for full UUID", () => {
  assert.equal(isUnnamedSession("f1a26b39-abcd-1234-5678-123456789abc"), true);
});

void test("returns false for descriptive label", () => {
  assert.equal(isUnnamedSession("Find launch communities"), false);
});

void test("returns false for action label with run number", () => {
  assert.equal(isUnnamedSession("Draft Product Hunt launch (4)"), false);
});
