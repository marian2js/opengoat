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

void test("groups sessions into per-day labels for 2-6 days ago", () => {
  // March 21 2026 is a Saturday. March 19 (Thursday) is 2 days ago.
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [session("1", "2026-03-19T10:00:00Z")];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "March 19");
  assert.equal(groups[0].sessions.length, 1);
});

void test("groups sessions 3-6 days ago with individual date labels", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [
    session("a", "2026-03-18T10:00:00Z"), // 3 days ago
    session("b", "2026-03-17T10:00:00Z"), // 4 days ago
    session("c", "2026-03-16T10:00:00Z"), // 5 days ago
    session("d", "2026-03-15T10:00:00Z"), // 6 days ago
  ];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 4);
  assert.equal(groups[0].label, "March 18");
  assert.equal(groups[1].label, "March 17");
  assert.equal(groups[2].label, "March 16");
  assert.equal(groups[3].label, "March 15");
});

void test("groups sessions older than 7 days into Earlier", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [session("1", "2026-03-10T10:00:00Z")];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Earlier");
});

void test("groups very old sessions into Earlier", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [session("1", "2026-01-15T10:00:00Z")];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Earlier");
});

void test("omits empty groups", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [
    session("1", "2026-03-21T10:00:00Z"), // Today
    session("2", "2026-01-05T10:00:00Z"), // Earlier
  ];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, "Today");
  assert.equal(groups[1].label, "Earlier");
});

void test("multiple sessions distributed across all group types", () => {
  const now = new Date("2026-03-21T14:00:00Z"); // Saturday
  const sessions = [
    session("a", "2026-03-21T08:00:00Z"), // Today
    session("b", "2026-03-21T09:00:00Z"), // Today
    session("c", "2026-03-20T15:00:00Z"), // Yesterday
    session("d", "2026-03-19T10:00:00Z"), // March 19
    session("e", "2026-03-18T10:00:00Z"), // March 18
    session("f", "2026-03-10T10:00:00Z"), // Earlier
    session("g", "2026-02-01T10:00:00Z"), // Earlier
  ];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 5);

  assert.equal(groups[0].label, "Today");
  assert.equal(groups[0].sessions.length, 2);

  assert.equal(groups[1].label, "Yesterday");
  assert.equal(groups[1].sessions.length, 1);

  assert.equal(groups[2].label, "March 19");
  assert.equal(groups[2].sessions.length, 1);

  assert.equal(groups[3].label, "March 18");
  assert.equal(groups[3].sessions.length, 1);

  assert.equal(groups[4].label, "Earlier");
  assert.equal(groups[4].sessions.length, 2);
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

void test("multiple sessions on same day within per-day range are grouped together", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  const sessions = [
    session("a", "2026-03-19T08:00:00Z"),
    session("b", "2026-03-19T14:00:00Z"),
    session("c", "2026-03-19T22:00:00Z"),
  ];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "March 19");
  assert.equal(groups[0].sessions.length, 3);
});

void test("session exactly at 7-day cutoff goes to Earlier", () => {
  const now = new Date("2026-03-21T14:00:00Z");
  // 7 days before todayStart (March 21 00:00) = March 14 00:00
  // Session right at that boundary
  const sessions = [session("1", "2026-03-13T23:59:59Z")];
  const groups = groupSessionsByDate(sessions, now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Earlier");
});
