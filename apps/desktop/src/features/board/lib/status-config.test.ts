import assert from "node:assert/strict";
import test from "node:test";
import { getStatusConfig } from "./status-config.js";

// ---------------------------------------------------------------------------
// getStatusConfig – status to label/className mapping
// ---------------------------------------------------------------------------

void test("getStatusConfig: maps 'todo' to 'To Do' label", () => {
  const config = getStatusConfig("todo");
  assert.equal(config.label, "To Do");
});

void test("getStatusConfig: maps 'doing' to 'Doing' label", () => {
  const config = getStatusConfig("doing");
  assert.equal(config.label, "Doing");
});

void test("getStatusConfig: maps 'pending' to 'Pending' label", () => {
  const config = getStatusConfig("pending");
  assert.equal(config.label, "Pending");
});

void test("getStatusConfig: maps 'blocked' to 'Blocked' label", () => {
  const config = getStatusConfig("blocked");
  assert.equal(config.label, "Blocked");
});

void test("getStatusConfig: maps 'done' to 'Done' label", () => {
  const config = getStatusConfig("done");
  assert.equal(config.label, "Done");
});

void test("getStatusConfig: returns unknown status as-is for unrecognized statuses", () => {
  const config = getStatusConfig("cancelled");
  assert.equal(config.label, "cancelled");
});

void test("getStatusConfig: each known status has a non-empty className", () => {
  for (const status of ["todo", "doing", "pending", "blocked", "done"]) {
    const config = getStatusConfig(status);
    assert.ok(typeof config.className === "string" && config.className.length > 0);
  }
});
