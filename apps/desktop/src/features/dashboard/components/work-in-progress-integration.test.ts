import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboardSrc = readFileSync(
  resolve(import.meta.dirname, "DashboardWorkspace.tsx"),
  "utf-8",
);

const appSrc = readFileSync(
  resolve(import.meta.dirname, "../../../app/App.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// DashboardWorkspace integration
// ---------------------------------------------------------------------------

void test("DashboardWorkspace: imports useRuns hook", () => {
  assert.ok(
    dashboardSrc.includes("useRuns"),
    "Expected import of useRuns hook",
  );
});

void test("DashboardWorkspace: imports WorkInProgress component", () => {
  assert.ok(
    dashboardSrc.includes("WorkInProgress"),
    "Expected import of WorkInProgress component",
  );
});

void test("DashboardWorkspace: calls useRuns hook", () => {
  assert.ok(
    dashboardSrc.includes("useRuns("),
    "Expected useRuns hook call in DashboardContent",
  );
});

void test("DashboardWorkspace: renders WorkInProgress between actions and board", () => {
  const wipIndex = dashboardSrc.indexOf("<WorkInProgress");
  const boardIndex = dashboardSrc.indexOf("<BoardSummary");
  const actionsIndex = dashboardSrc.indexOf("<SuggestedActionGrid");
  assert.ok(wipIndex > 0, "Expected WorkInProgress to be rendered");
  assert.ok(
    wipIndex > actionsIndex && wipIndex < boardIndex,
    "Expected WorkInProgress between SuggestedActionGrid and BoardSummary",
  );
});

void test("DashboardWorkspace: passes onResumeRun prop to WorkInProgress", () => {
  assert.ok(
    dashboardSrc.includes("onResumeRun"),
    "Expected onResumeRun prop on WorkInProgress",
  );
});

void test("DashboardWorkspace: has onResumeRun in props interface", () => {
  assert.ok(
    dashboardSrc.includes("onResumeRun?:") || dashboardSrc.includes("onResumeRun:"),
    "Expected onResumeRun in DashboardWorkspaceProps",
  );
});

void test("DashboardWorkspace: hides WorkInProgress section when empty", () => {
  assert.ok(
    dashboardSrc.includes("runsResult.isEmpty") || dashboardSrc.includes("isEmpty"),
    "Expected conditional rendering based on isEmpty",
  );
});

// ---------------------------------------------------------------------------
// App.tsx integration
// ---------------------------------------------------------------------------

void test("App.tsx: defines handleResumeRun callback", () => {
  assert.ok(
    appSrc.includes("handleResumeRun"),
    "Expected handleResumeRun callback in App.tsx",
  );
});

void test("App.tsx: handleResumeRun sets activeSessionId and navigates to chat", () => {
  assert.ok(
    appSrc.includes("setActiveSessionId") && appSrc.includes("#chat"),
    "Expected handleResumeRun to set session and navigate",
  );
});

void test("App.tsx: passes onResumeRun to DashboardWorkspace", () => {
  assert.ok(
    appSrc.includes("onResumeRun={handleResumeRun}"),
    "Expected onResumeRun prop passed to DashboardWorkspace",
  );
});
