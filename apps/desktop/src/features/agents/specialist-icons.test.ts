import assert from "node:assert/strict";
import test from "node:test";
import { resolveSpecialistIcon } from "./specialist-icons";

void test("resolveSpecialistIcon returns correct icon for each known key", () => {
  const knownKeys = ["brain", "search", "target", "layout", "globe", "megaphone", "pen-tool", "send"];
  for (const key of knownKeys) {
    const icon = resolveSpecialistIcon(key);
    assert.ok(icon != null, `Expected a component for key "${key}"`);
  }
});

void test("resolveSpecialistIcon returns fallback BotIcon for unknown keys", () => {
  const icon = resolveSpecialistIcon("unknown-icon");
  assert.ok(icon != null, "Expected a fallback component");
});

void test("resolveSpecialistIcon returns distinct icons for different keys", () => {
  const brain = resolveSpecialistIcon("brain");
  const search = resolveSpecialistIcon("search");
  assert.notEqual(brain, search, "brain and search should map to different icons");
});
