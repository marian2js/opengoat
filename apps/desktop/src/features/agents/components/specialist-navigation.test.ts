import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "../../../app/config/navigation.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC: Agents is now in primary nav, not secondary
// ---------------------------------------------------------------------------

void test("Agents is in primaryNavigation array", () => {
  // Extract the primaryNavigation block
  const primaryBlock = src.slice(
    src.indexOf("primaryNavigation"),
    src.indexOf("brainNavigation"),
  );
  assert.ok(
    primaryBlock.includes('"Agents"'),
    "Agents must be in primaryNavigation",
  );
  assert.ok(
    primaryBlock.includes("#agents"),
    "Agents href must be #agents",
  );
});

void test("Agents is NOT in secondaryNavigation array", () => {
  const secondaryBlock = src.slice(src.indexOf("secondaryNavigation"));
  assert.ok(
    !secondaryBlock.includes('"Agents"'),
    "Agents must not be in secondaryNavigation",
  );
});

// ---------------------------------------------------------------------------
// AC: Nav order is Dashboard, Agents, Chat, Board per spec Section 10.1
// ---------------------------------------------------------------------------

void test("Primary nav order is Dashboard, Agents, Chat, Board", () => {
  const primaryBlock = src.slice(
    src.indexOf("primaryNavigation"),
    src.indexOf("brainNavigation"),
  );
  const dashboardIdx = primaryBlock.indexOf('"Dashboard"');
  const agentsIdx = primaryBlock.indexOf('"Agents"');
  const chatIdx = primaryBlock.indexOf('"Chat"');
  const boardIdx = primaryBlock.indexOf('"Board"');

  assert.ok(dashboardIdx >= 0, "Dashboard must be in primary nav");
  assert.ok(agentsIdx >= 0, "Agents must be in primary nav");
  assert.ok(chatIdx >= 0, "Chat must be in primary nav");
  assert.ok(boardIdx >= 0, "Board must be in primary nav");

  assert.ok(dashboardIdx < agentsIdx, "Dashboard must come before Agents");
  assert.ok(agentsIdx < chatIdx, "Agents must come before Chat");
  assert.ok(chatIdx < boardIdx, "Chat must come before Board");
});

// ---------------------------------------------------------------------------
// AC: Agents icon changed to UsersIcon (team metaphor)
// ---------------------------------------------------------------------------

void test("Agents uses UsersIcon for team metaphor", () => {
  assert.ok(
    src.includes("UsersIcon"),
    "Navigation must import and use UsersIcon for the Agents item",
  );
});
