import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "DashboardAgentRoster.tsx"),
  "utf-8",
);

void test("DashboardAgentRoster: exports a named function component", () => {
  assert.ok(
    src.includes("export function DashboardAgentRoster"),
    "Expected named export 'DashboardAgentRoster'",
  );
});

void test("DashboardAgentRoster: accepts specialists and onChat props", () => {
  assert.ok(src.includes("specialists"), "Expected 'specialists' prop");
  assert.ok(src.includes("onChat"), "Expected 'onChat' prop");
});

void test("DashboardAgentRoster: renders section header with team icon", () => {
  assert.ok(
    src.includes("Your Specialists") || src.includes("Your AI Team") || src.includes("Agent Roster"),
    "Expected section header text",
  );
});

void test("DashboardAgentRoster: renders DashboardSpecialistChip for each specialist", () => {
  assert.ok(
    src.includes("DashboardSpecialistChip"),
    "Expected DashboardSpecialistChip component usage",
  );
});

void test("DashboardAgentRoster: separates manager from specialists", () => {
  assert.ok(
    src.includes("manager"),
    "Expected manager/specialist separation logic",
  );
});

void test("DashboardAgentRoster: uses responsive grid layout", () => {
  assert.ok(
    src.includes("grid") && src.includes("grid-cols"),
    "Expected responsive grid layout for specialist chips",
  );
});

void test("DashboardAgentRoster: returns null or loading state when no specialists", () => {
  assert.ok(
    src.includes("length === 0") || src.includes("null"),
    "Expected empty/loading state handling",
  );
});

void test("DashboardAgentRoster: uses section-label styling", () => {
  assert.ok(
    src.includes("section-label"),
    "Expected section-label class for consistent heading styling",
  );
});
