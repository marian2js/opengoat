import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "ConnectionsWorkspace.tsx"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// AC1: No redundant h1 "Connections" heading in content area
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace does not render a standalone h1 heading", () => {
  assert.ok(
    !src.includes("<h1"),
    "Must NOT have an h1 heading — the top bar already provides the page title",
  );
});

// ---------------------------------------------------------------------------
// AC2: No orphaned subtitle text
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace does not render the subtitle paragraph", () => {
  assert.ok(
    !src.includes("Manage AI providers and messaging channels"),
    "Must NOT include the subtitle 'Manage AI providers and messaging channels' — it is redundant",
  );
});

// ---------------------------------------------------------------------------
// AC3: Section label h2 still present
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace still has section-label h2", () => {
  assert.ok(
    src.includes("section-label"),
    "Must keep the section-label h2 for the Connections section",
  );
});

// ---------------------------------------------------------------------------
// AC4: Section content (table, empty state) still present
// ---------------------------------------------------------------------------

void test("ConnectionsWorkspace still renders connection table or empty state", () => {
  assert.ok(
    src.includes("<Table") || src.includes("No connections yet"),
    "Must still render the connections table or empty state",
  );
});
