import assert from "node:assert/strict";
import test from "node:test";
import {
  isReRunLabel,
  getBaseTitle,
  getDeEmphasizedSessionIds,
} from "./session-rerun";

// ---------------------------------------------------------------------------
// isReRunLabel
// ---------------------------------------------------------------------------

void test("isReRunLabel returns false for labels without suffix", () => {
  assert.equal(isReRunLabel("Find launch communities"), false);
});

void test("isReRunLabel returns false for (1) suffix", () => {
  assert.equal(isReRunLabel("Find launch communities (1)"), false);
});

void test("isReRunLabel returns true for (2) suffix", () => {
  assert.equal(isReRunLabel("Find launch communities (2)"), true);
});

void test("isReRunLabel returns true for high numbers", () => {
  assert.equal(isReRunLabel("Find launch communities (19)"), true);
});

void test("isReRunLabel returns false for empty string", () => {
  assert.equal(isReRunLabel(""), false);
});

void test("isReRunLabel returns false for parenthesized text that is not a number", () => {
  assert.equal(isReRunLabel("Setup (beta)"), false);
});

// ---------------------------------------------------------------------------
// getBaseTitle
// ---------------------------------------------------------------------------

void test("getBaseTitle strips (N) suffix", () => {
  assert.equal(getBaseTitle("Find launch communities (19)"), "Find launch communities");
});

void test("getBaseTitle returns unchanged label without suffix", () => {
  assert.equal(getBaseTitle("Find launch communities"), "Find launch communities");
});

void test("getBaseTitle strips (1) suffix too", () => {
  assert.equal(getBaseTitle("Action (1)"), "Action");
});

// ---------------------------------------------------------------------------
// getDeEmphasizedSessionIds
// ---------------------------------------------------------------------------

void test("returns empty set when no sessions", () => {
  const result = getDeEmphasizedSessionIds([]);
  assert.equal(result.size, 0);
});

void test("returns empty set when no re-runs exist", () => {
  const sessions = [
    { id: "a", label: "Unique action", updatedAt: "2026-03-21T10:00:00Z" },
    { id: "b", label: "Another action", updatedAt: "2026-03-21T11:00:00Z" },
  ];
  const result = getDeEmphasizedSessionIds(sessions);
  assert.equal(result.size, 0);
});

void test("does not de-emphasize the most recent re-run", () => {
  const sessions = [
    { id: "a", label: "Find communities (2)", updatedAt: "2026-03-21T10:00:00Z" },
    { id: "b", label: "Find communities (3)", updatedAt: "2026-03-21T11:00:00Z" },
  ];
  const result = getDeEmphasizedSessionIds(sessions);
  assert.equal(result.has("a"), true, "older re-run should be de-emphasized");
  assert.equal(result.has("b"), false, "most recent re-run should NOT be de-emphasized");
});

void test("de-emphasizes all older re-runs, keeps only latest", () => {
  const sessions = [
    { id: "a", label: "Find communities (17)", updatedAt: "2026-03-21T08:00:00Z" },
    { id: "b", label: "Find communities (18)", updatedAt: "2026-03-21T09:00:00Z" },
    { id: "c", label: "Find communities (19)", updatedAt: "2026-03-21T10:00:00Z" },
  ];
  const result = getDeEmphasizedSessionIds(sessions);
  assert.equal(result.size, 2);
  assert.equal(result.has("a"), true);
  assert.equal(result.has("b"), true);
  assert.equal(result.has("c"), false);
});

void test("does not de-emphasize unique conversations", () => {
  const sessions = [
    { id: "a", label: "Find communities (19)", updatedAt: "2026-03-21T10:00:00Z" },
    { id: "b", label: "Unique conversation", updatedAt: "2026-03-21T11:00:00Z" },
  ];
  const result = getDeEmphasizedSessionIds(sessions);
  assert.equal(result.size, 0, "single re-run and unique should both have full weight");
});

void test("does not de-emphasize (1) suffix conversations", () => {
  const sessions = [
    { id: "a", label: "Action (1)", updatedAt: "2026-03-21T10:00:00Z" },
  ];
  const result = getDeEmphasizedSessionIds(sessions);
  assert.equal(result.size, 0);
});

void test("handles multiple action groups independently", () => {
  const sessions = [
    { id: "a", label: "Find communities (2)", updatedAt: "2026-03-21T08:00:00Z" },
    { id: "b", label: "Find communities (3)", updatedAt: "2026-03-21T09:00:00Z" },
    { id: "c", label: "Analyze competitors (2)", updatedAt: "2026-03-21T07:00:00Z" },
    { id: "d", label: "Analyze competitors (3)", updatedAt: "2026-03-21T10:00:00Z" },
  ];
  const result = getDeEmphasizedSessionIds(sessions);
  assert.equal(result.size, 2);
  assert.equal(result.has("a"), true, "older Find communities");
  assert.equal(result.has("c"), true, "older Analyze competitors");
  assert.equal(result.has("b"), false, "latest Find communities");
  assert.equal(result.has("d"), false, "latest Analyze competitors");
});

void test("handles sessions with undefined label", () => {
  const sessions = [
    { id: "a", label: undefined, updatedAt: "2026-03-21T10:00:00Z" },
    { id: "b", label: "Find communities (2)", updatedAt: "2026-03-21T11:00:00Z" },
  ];
  const result = getDeEmphasizedSessionIds(sessions);
  assert.equal(result.size, 0);
});

void test("single re-run is not de-emphasized (it is the latest by definition)", () => {
  const sessions = [
    { id: "a", label: "Find communities (5)", updatedAt: "2026-03-21T10:00:00Z" },
  ];
  const result = getDeEmphasizedSessionIds(sessions);
  assert.equal(result.size, 0);
});
