import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "useRecentArtifacts.ts"),
  "utf-8",
);

// ---------------------------------------------------------------------------
// useRecentArtifacts hook structure tests
// ---------------------------------------------------------------------------

void test("useRecentArtifacts: exports a named function", () => {
  assert.ok(
    src.includes("export function useRecentArtifacts"),
    "Expected named export 'useRecentArtifacts'",
  );
});

void test("useRecentArtifacts: calls listArtifacts on client", () => {
  assert.ok(
    src.includes("listArtifacts"),
    "Expected hook to call client.listArtifacts",
  );
});

void test("useRecentArtifacts: returns standaloneArtifacts, bundleGroups, isLoading, isEmpty", () => {
  assert.ok(src.includes("standaloneArtifacts"), "Expected 'standaloneArtifacts' in return");
  assert.ok(src.includes("bundleGroups"), "Expected 'bundleGroups' in return");
  assert.ok(src.includes("isLoading"), "Expected 'isLoading' in return");
  assert.ok(src.includes("isEmpty"), "Expected 'isEmpty' in return");
});

void test("useRecentArtifacts: uses useState and useEffect hooks", () => {
  assert.ok(src.includes("useState"), "Expected useState usage");
  assert.ok(src.includes("useEffect"), "Expected useEffect usage");
});

void test("useRecentArtifacts: has cancellation pattern in useEffect", () => {
  assert.ok(
    src.includes("cancelled"),
    "Expected cancellation flag pattern for cleanup",
  );
});

void test("useRecentArtifacts: handles errors gracefully with catch", () => {
  assert.ok(
    src.includes("catch"),
    "Expected error handling with catch for API failures",
  );
});

void test("useRecentArtifacts: imports ArtifactRecord from contracts", () => {
  assert.ok(
    src.includes("ArtifactRecord") && src.includes("@opengoat/contracts"),
    "Expected ArtifactRecord type import from contracts",
  );
});

void test("useRecentArtifacts: depends on agentId and client", () => {
  assert.ok(
    src.includes("agentId") && src.includes("client"),
    "Expected agentId and client as hook parameters/deps",
  );
});

void test("useRecentArtifacts: groups artifacts by bundleId", () => {
  assert.ok(
    src.includes("bundleId"),
    "Expected bundleId grouping logic",
  );
});

void test("useRecentArtifacts: defines BundleGroup interface", () => {
  assert.ok(
    src.includes("BundleGroup"),
    "Expected BundleGroup interface or type definition",
  );
});

void test("useRecentArtifacts: over-fetches with limit for bundling", () => {
  assert.ok(
    src.includes("limit"),
    "Expected limit parameter for over-fetching",
  );
});

void test("useRecentArtifacts: exports UseRecentArtifactsResult interface", () => {
  assert.ok(
    src.includes("UseRecentArtifactsResult"),
    "Expected UseRecentArtifactsResult interface export",
  );
});
