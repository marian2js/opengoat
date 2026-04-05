import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "DashboardWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// Dashboard Objective Integration — verifies DashboardWorkspace wiring
// ---------------------------------------------------------------------------

void test("DashboardWorkspace: imports useActiveObjective hook", () => {
  assert.ok(
    src.includes("useActiveObjective"),
    "Expected useActiveObjective import for fetching active objective",
  );
});

void test("DashboardWorkspace: imports ActiveObjectiveSection component", () => {
  assert.ok(
    src.includes("ActiveObjectiveSection"),
    "Expected ActiveObjectiveSection import",
  );
});

void test("DashboardWorkspace: imports ObjectiveComposerPrompt component", () => {
  assert.ok(
    src.includes("ObjectiveComposerPrompt"),
    "Expected ObjectiveComposerPrompt import for no-objective state",
  );
});

void test("DashboardWorkspace: imports ObjectiveCreationSheet component", () => {
  assert.ok(
    src.includes("ObjectiveCreationSheet"),
    "Expected ObjectiveCreationSheet import for creation flow",
  );
});

void test("DashboardWorkspace: renders CompanyUnderstandingHero", () => {
  const heroIdx = src.indexOf("<CompanyUnderstandingHero");
  assert.ok(
    heroIdx > 0,
    "Expected CompanyUnderstandingHero JSX in DashboardWorkspace",
  );
});

void test("DashboardWorkspace: has state for sheet open/close", () => {
  assert.ok(
    src.includes("isCreationOpen") && src.includes("setIsCreationOpen"),
    "Expected state management for sheet open/close",
  );
});

void test("DashboardWorkspace: conditionally renders ActiveObjectiveSection or ObjectiveComposerPrompt", () => {
  assert.ok(
    src.includes("activeObjective.objective") &&
    src.includes("ActiveObjectiveSection") &&
    src.includes("ObjectiveComposerPrompt"),
    "Expected conditional rendering based on active objective existence",
  );
});

void test("DashboardWorkspace: passes refetch callback to ObjectiveCreationSheet", () => {
  assert.ok(
    src.includes("onObjectiveCreated") && src.includes("refetch"),
    "Expected refetch wiring through onObjectiveCreated callback",
  );
});

void test("DashboardWorkspace: passes open task count to ActiveObjectiveSection", () => {
  assert.ok(
    src.includes("openTaskCount") && src.includes("boardSummary.counts.open"),
    "Expected open task count from board summary passed to active objective section",
  );
});

void test("DashboardWorkspace: renders ObjectiveCreationSheet at the end of component tree", () => {
  const sheetIdx = src.lastIndexOf("ObjectiveCreationSheet");
  const divCloseIdx = src.lastIndexOf("</div>");
  assert.ok(
    sheetIdx > 0 && sheetIdx < divCloseIdx,
    "Expected ObjectiveCreationSheet rendered at end of component tree (portaled)",
  );
});

void test("DashboardWorkspace: supports prefillTitle from composer prompt to creation sheet", () => {
  assert.ok(
    src.includes("prefillTitle") && src.includes("setPrefillTitle"),
    "Expected prefillTitle state management for passing goal type to sheet",
  );
});
