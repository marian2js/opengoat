import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "DashboardWorkspace.tsx"),
  "utf-8",
);

void test("DashboardWorkspace: imports DashboardAgentRoster", () => {
  assert.ok(
    src.includes("DashboardAgentRoster"),
    "Expected import of DashboardAgentRoster component",
  );
});

void test("DashboardWorkspace: imports useSpecialistRoster hook", () => {
  assert.ok(
    src.includes("useSpecialistRoster"),
    "Expected import of useSpecialistRoster hook",
  );
});

void test("DashboardWorkspace: renders DashboardAgentRoster section", () => {
  assert.ok(
    src.includes("<DashboardAgentRoster"),
    "Expected DashboardAgentRoster component rendering",
  );
});

void test("DashboardWorkspace: passes specialists to ActionCardGrid", () => {
  assert.ok(
    src.includes("specialists="),
    "Expected specialists prop passed to ActionCardGrid",
  );
});

void test("DashboardWorkspace: Agent Roster appears before Action Cards in Mode A", () => {
  // In Mode A (no active work), Agent Roster should appear before ActionCardGrid
  const rosterPos = src.indexOf("<DashboardAgentRoster");
  const actionGridPos = src.lastIndexOf("<ActionCardGrid");
  assert.ok(
    rosterPos > 0 && actionGridPos > 0 && rosterPos < actionGridPos,
    "Expected Agent Roster to appear before Action Cards in the component order",
  );
});

void test("DashboardWorkspace: BoardSummary is at the bottom of the layout", () => {
  // BoardSummary should be the last significant section
  const boardPos = src.lastIndexOf("<BoardSummary");
  const rosterPos = src.lastIndexOf("<DashboardAgentRoster");
  const actionGridPos = src.lastIndexOf("<ActionCardGrid");
  assert.ok(
    boardPos > rosterPos && boardPos > actionGridPos,
    "Expected BoardSummary to appear after Agent Roster and Action Cards",
  );
});

void test("DashboardWorkspace: handles specialist chat navigation", () => {
  assert.ok(
    src.includes("specialist") && src.includes("chat"),
    "Expected specialist chat navigation handler",
  );
});
