import assert from "node:assert/strict";
import test from "node:test";
import { groupSessionsByDate, type DateGroup } from "./group-sessions-by-date";

interface MinimalSession {
  id: string;
  createdAt: string;
  label?: string;
}

function session(id: string, createdAt: string): MinimalSession {
  return {
    id,
    createdAt,
    label: `Session ${id}`,
  };
}

void test("returns empty array when no sessions", () => {
  const groups = groupSessionsByDate([], new Date("2026-03-21T12:00:00Z"));
  assert.equal(groups.length, 0);
});

void test("groups sessions into Today", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [session("1", "2026-03-21T10:00:00Z")];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Today");
  assert.equal(groups[0].sessions.length, 1);
  assert.equal(groups[0].sessions[0].id, "1");
});

void test("groups sessions into Yesterday", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [session("1", "2026-03-20T10:00:00Z")];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Yesterday");
  assert.equal(groups[0].sessions.length, 1);
});

void test("groups sessions into This Week", () => {
  // March 21 2026 is a Saturday. March 18 (Wednesday) is this week but not today/yesterday.
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [session("1", "2026-03-18T10:00:00Z")];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "This Week");
});

void test("groups sessions into This Month", () => {
  // March 21 2026 is Saturday. March 10 is more than a week ago but same month.
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [session("1", "2026-03-10T10:00:00Z")];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "This Month");
});

void test("groups sessions into Older", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [session("1", "2026-01-15T10:00:00Z")];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Older");
});

void test("omits empty groups", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [
    session("1", "2026-03-21T10:00:00Z"), // Today
    session("2", "2026-01-05T10:00:00Z"), // Older
  ];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, "Today");
  assert.equal(groups[1].label, "Older");
});

void test("multiple sessions distributed across all groups", () => {
  const now = new Date("2026-03-21T14:00:00Z"); // Saturday
  const sessions = [
    session("a", "2026-03-21T08:00:00Z"), // Today
    session("b", "2026-03-21T09:00:00Z"), // Today
    session("c", "2026-03-20T15:00:00Z"), // Yesterday
    session("d", "2026-03-19T10:00:00Z"), // This Week (Thursday)
    session("e", "2026-03-10T10:00:00Z"), // This Month
    session("f", "2026-02-01T10:00:00Z"), // Older
  ];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 5);

  assert.equal(groups[0].label, "Today");
  assert.equal(groups[0].sessions.length, 2);

  assert.equal(groups[1].label, "Yesterday");
  assert.equal(groups[1].sessions.length, 1);

  assert.equal(groups[2].label, "This Week");
  assert.equal(groups[2].sessions.length, 1);

  assert.equal(groups[3].label, "This Month");
  assert.equal(groups[3].sessions.length, 1);

  assert.equal(groups[4].label, "Older");
  assert.equal(groups[4].sessions.length, 1);
});

void test("preserves original session order within groups", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [
    session("a", "2026-03-21T08:00:00Z"),
    session("b", "2026-03-21T12:00:00Z"),
    session("c", "2026-03-21T06:00:00Z"),
  ];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups[0].sessions[0].id, "a");
  assert.equal(groups[0].sessions[1].id, "b");
  assert.equal(groups[0].sessions[2].id, "c");
});

void test("handles day boundary — session at midnight", () => {
  const now = new Date("2026-03-21T00:00:01Z");
  const sessions = [session("1", "2026-03-21T00:00:00Z")];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Today");
});
