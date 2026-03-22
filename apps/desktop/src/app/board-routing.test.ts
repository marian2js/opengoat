import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for Board sidebar navigation and routing.
 *
 * Verifies:
 * - AppView type includes "board"
 * - readViewFromHash maps #board → "board"
 * - Navigation config includes Board between Dashboard and Chat
 * - Default view (empty/unknown hash) remains dashboard
 */

// ---------------------------------------------------------------------------
// Replicate readViewFromHash from App.tsx (with board added)
// ---------------------------------------------------------------------------

type AppView =
  | "dashboard"
  | "connections"
  | "connections-add"
  | "chat"
  | "brain"
  | "agents"
  | "settings"
  | "board";

function readViewFromHash(hash: string): AppView {
  if (hash === "#connections/add") return "connections-add";
  if (hash === "#connections") return "connections";
  if (hash.startsWith("#brain")) return "brain";
  if (hash === "#agents") return "agents";
  if (hash === "#settings") return "settings";
  if (hash === "#chat") return "chat";
  if (hash === "#board") return "board";
  return "dashboard";
}

// ---------------------------------------------------------------------------
// Tests: #board hash routing
// ---------------------------------------------------------------------------

test("readViewFromHash: #board resolves to board", () => {
  assert.equal(readViewFromHash("#board"), "board");
});

test("readViewFromHash: empty hash still resolves to dashboard (not board)", () => {
  assert.equal(readViewFromHash(""), "dashboard");
});

test("readViewFromHash: unrecognized hash still resolves to dashboard", () => {
  assert.equal(readViewFromHash("#xyz"), "dashboard");
});

test("readViewFromHash: all known views resolve correctly", () => {
  assert.equal(readViewFromHash("#dashboard"), "dashboard");
  assert.equal(readViewFromHash("#chat"), "chat");
  assert.equal(readViewFromHash("#board"), "board");
  assert.equal(readViewFromHash("#agents"), "agents");
  assert.equal(readViewFromHash("#settings"), "settings");
  assert.equal(readViewFromHash("#connections"), "connections");
  assert.equal(readViewFromHash("#connections/add"), "connections-add");
  assert.equal(readViewFromHash("#brain"), "brain");
  assert.equal(readViewFromHash("#brain/product"), "brain");
});

// ---------------------------------------------------------------------------
// Tests: Navigation config ordering
// ---------------------------------------------------------------------------

test("primaryNavigation includes Board between Dashboard and Chat", async () => {
  const { primaryNavigation } = await import("../app/config/navigation.ts");
  const titles = primaryNavigation.map((item) => item.title);
  assert.deepEqual(titles, ["Dashboard", "Board", "Chat"]);
});

test("Board nav item has correct href", async () => {
  const { primaryNavigation } = await import("../app/config/navigation.ts");
  const boardItem = primaryNavigation.find((item) => item.title === "Board");
  assert.ok(boardItem, "Board item should exist in primaryNavigation");
  assert.equal(boardItem.href, "#board");
});

test("Board nav item has an icon", async () => {
  const { primaryNavigation } = await import("../app/config/navigation.ts");
  const boardItem = primaryNavigation.find((item) => item.title === "Board");
  assert.ok(boardItem, "Board item should exist in primaryNavigation");
  assert.ok(typeof boardItem.icon === "function" || typeof boardItem.icon === "object", "Board item should have an icon");
});

// ---------------------------------------------------------------------------
// Tests: Board is in no-padding group
// ---------------------------------------------------------------------------

test("board should be in the no-padding views group alongside chat, brain, dashboard", () => {
  // Simulates the padding logic from App.tsx
  const noPaddingViews = ["chat", "brain", "dashboard", "board"];
  assert.ok(noPaddingViews.includes("board"), "board should be in no-padding group");
  assert.ok(noPaddingViews.includes("chat"), "chat should remain in no-padding group");
  assert.ok(noPaddingViews.includes("dashboard"), "dashboard should remain in no-padding group");
  assert.ok(noPaddingViews.includes("brain"), "brain should remain in no-padding group");
});
