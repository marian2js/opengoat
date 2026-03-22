import assert from "node:assert/strict";
import test from "node:test";
import { formatRelativeTime } from "./format-relative-time.js";

// ---------------------------------------------------------------------------
// formatRelativeTime – relative time display
// ---------------------------------------------------------------------------

void test("formatRelativeTime: returns 'just now' for timestamps within the last 60 seconds", () => {
  const now = new Date();
  assert.equal(formatRelativeTime(now.toISOString()), "just now");
});

void test("formatRelativeTime: returns minutes ago for timestamps within the last hour", () => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  assert.equal(formatRelativeTime(fiveMinAgo.toISOString()), "5m ago");
});

void test("formatRelativeTime: returns hours ago for timestamps within the last day", () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  assert.equal(formatRelativeTime(twoHoursAgo.toISOString()), "2h ago");
});

void test("formatRelativeTime: returns days ago for timestamps within the last 7 days", () => {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  assert.equal(formatRelativeTime(threeDaysAgo.toISOString()), "3d ago");
});

void test("formatRelativeTime: returns formatted date for timestamps older than 7 days", () => {
  const oldDate = new Date("2024-03-15T12:00:00Z");
  const result = formatRelativeTime(oldDate.toISOString());
  // Should contain "Mar 15" or similar locale-based format
  assert.ok(result.includes("Mar"), `Expected date to contain "Mar", got "${result}"`);
  assert.ok(result.includes("15"), `Expected date to contain "15", got "${result}"`);
});

void test("formatRelativeTime: handles 1 minute ago", () => {
  const oneMinAgo = new Date(Date.now() - 60 * 1000);
  assert.equal(formatRelativeTime(oneMinAgo.toISOString()), "1m ago");
});

void test("formatRelativeTime: handles 1 hour ago", () => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  assert.equal(formatRelativeTime(oneHourAgo.toISOString()), "1h ago");
});

void test("formatRelativeTime: handles 1 day ago", () => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  assert.equal(formatRelativeTime(oneDayAgo.toISOString()), "1d ago");
});
