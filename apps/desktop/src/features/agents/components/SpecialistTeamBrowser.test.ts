import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "SpecialistTeamBrowser.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC: Page header reads "Your AI Marketing Team"
// ---------------------------------------------------------------------------

void test("SpecialistTeamBrowser has 'Your AI Marketing Team' header", () => {
  assert.ok(
    src.includes("Your AI Marketing Team"),
    "Page header must read 'Your AI Marketing Team'",
  );
});

// ---------------------------------------------------------------------------
// AC: Fetches specialists from SidecarClient
// ---------------------------------------------------------------------------

void test("SpecialistTeamBrowser fetches from client.specialists()", () => {
  assert.ok(
    src.includes("client.specialists") || src.includes("specialists()"),
    "Must fetch specialists from SidecarClient",
  );
});

// ---------------------------------------------------------------------------
// AC: Page does NOT feel like configuration
// ---------------------------------------------------------------------------

void test("SpecialistTeamBrowser has no provider selectors", () => {
  assert.ok(
    !src.includes("Select provider"),
    "Must not have provider selector UI",
  );
  assert.ok(
    !src.includes("Provider default"),
    "Must not have model/provider configuration UI",
  );
});

void test("SpecialistTeamBrowser has no Agent Library header", () => {
  assert.ok(
    !src.includes("Agent Library"),
    "Must not have the old 'Agent Library' header",
  );
});

// ---------------------------------------------------------------------------
// AC: Renders SpecialistCard for each specialist
// ---------------------------------------------------------------------------

void test("SpecialistTeamBrowser renders SpecialistCard components", () => {
  assert.ok(
    src.includes("SpecialistCard"),
    "Must render SpecialistCard components",
  );
});

// ---------------------------------------------------------------------------
// AC: onChat handler navigates to specialist chat
// ---------------------------------------------------------------------------

void test("SpecialistTeamBrowser navigates to #chat?specialist=id on CTA click", () => {
  assert.ok(
    src.includes("#chat?specialist="),
    "Must navigate to #chat?specialist=<id> when CTA is clicked",
  );
});

// ---------------------------------------------------------------------------
// AC: Has loading, error, and populated states
// ---------------------------------------------------------------------------

void test("SpecialistTeamBrowser has loading state", () => {
  assert.ok(
    src.includes("Loading") || src.includes("loading") || src.includes("isLoading") || src.includes("LoaderCircle"),
    "Must handle loading state",
  );
});

void test("SpecialistTeamBrowser has error state", () => {
  assert.ok(
    src.includes("error") || src.includes("Error"),
    "Must handle error state",
  );
});

// ---------------------------------------------------------------------------
// AC: 2-column grid layout
// ---------------------------------------------------------------------------

void test("SpecialistTeamBrowser uses 2-column grid on desktop", () => {
  assert.ok(
    src.includes("grid-cols-2") || src.includes("lg:grid-cols-2") || src.includes("md:grid-cols-2"),
    "Must use 2-column grid layout on desktop",
  );
});

// ---------------------------------------------------------------------------
// AC: Uses DESIGN.md styling
// ---------------------------------------------------------------------------

void test("SpecialistTeamBrowser uses font-display for heading", () => {
  assert.ok(
    src.includes("font-display"),
    "Page heading must use font-display (General Sans)",
  );
});

void test("SpecialistTeamBrowser component is under 300 lines", () => {
  const lineCount = src.split("\n").length;
  assert.ok(
    lineCount <= 300,
    `Component must be under 300 lines, but is ${lineCount} lines`,
  );
});
