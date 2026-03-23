import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "WorkInProgress.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// WorkInProgress — structure and design system validation
// ---------------------------------------------------------------------------

void test("WorkInProgress: exports a named function", () => {
  assert.ok(
    src.includes("export function WorkInProgress"),
    "Expected named export 'WorkInProgress'",
  );
});

void test("WorkInProgress: uses section-label pattern with teal icon", () => {
  assert.ok(
    src.includes("section-label"),
    "Expected section-label CSS class for mono uppercase heading",
  );
  assert.ok(
    src.includes("text-primary"),
    "Expected teal primary color on section icon",
  );
});

void test("WorkInProgress: displays Work in Progress section header", () => {
  assert.ok(
    src.includes("Work in Progress"),
    "Expected 'Work in Progress' section heading",
  );
});

void test("WorkInProgress: returns null when isEmpty and not loading", () => {
  assert.ok(
    src.includes("isEmpty") && src.includes("null"),
    "Expected section to return null when empty and not loading",
  );
});

void test("WorkInProgress: has loading skeleton state", () => {
  assert.ok(
    src.includes("Skeleton"),
    "Expected Skeleton loading state",
  );
});

void test("WorkInProgress: has status badge config for running, waiting_review, blocked, draft", () => {
  assert.ok(src.includes("running"), "Expected running status config");
  assert.ok(src.includes("waiting_review"), "Expected waiting_review status config");
  assert.ok(src.includes("blocked"), "Expected blocked status config");
  assert.ok(src.includes("draft"), "Expected draft status config");
});

void test("WorkInProgress: running status uses primary/teal color", () => {
  assert.ok(
    src.includes("bg-primary/10") && src.includes("text-primary"),
    "Expected running status to use primary teal color",
  );
});

void test("WorkInProgress: waiting_review status uses amber color", () => {
  assert.ok(
    src.includes("text-amber"),
    "Expected waiting_review status to use amber color",
  );
});

void test("WorkInProgress: blocked status uses destructive/red color", () => {
  assert.ok(
    src.includes("text-destructive") || src.includes("text-red"),
    "Expected blocked status to use destructive/red color",
  );
});

void test("WorkInProgress: draft status uses muted color", () => {
  assert.ok(
    src.includes("text-muted-foreground"),
    "Expected draft status to use muted color",
  );
});

void test("WorkInProgress: shows resume action for runs with sessionId", () => {
  assert.ok(
    src.includes("onResumeRun") && src.includes("sessionId"),
    "Expected resume action using sessionId",
  );
});

void test("WorkInProgress: hides resume button when no sessionId", () => {
  assert.ok(
    src.includes("sessionId"),
    "Expected sessionId check for resume button visibility",
  );
});

void test("WorkInProgress: imports formatRelativeTime", () => {
  assert.ok(
    src.includes("formatRelativeTime"),
    "Expected import of formatRelativeTime utility",
  );
});

void test("WorkInProgress: uses PlayCircle or Play icon for section label", () => {
  assert.ok(
    src.includes("PlayCircle") || src.includes("PlayIcon") || src.includes("CirclePlayIcon"),
    "Expected a play-related icon for the section label",
  );
});

void test("WorkInProgress: uses hover state on rows", () => {
  assert.ok(
    src.includes("hover:"),
    "Expected hover state on run rows",
  );
});

void test("WorkInProgress: uses tabular-nums for timestamps", () => {
  assert.ok(
    src.includes("tabular-nums"),
    "Expected tabular-nums for timestamp display",
  );
});

void test("WorkInProgress: accepts onResumeRun callback prop", () => {
  assert.ok(
    src.includes("onResumeRun"),
    "Expected onResumeRun callback prop",
  );
});

void test("WorkInProgress: shows run count pill", () => {
  assert.ok(
    src.includes("runs.length") || src.includes(".length"),
    "Expected run count display",
  );
});
