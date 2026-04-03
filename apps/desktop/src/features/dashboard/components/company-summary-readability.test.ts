import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "CompanySummary.tsx"),
  "utf-8",
);

void test("CompanySummary: description text is at least 13px", () => {
  // The description paragraph should use text-[13px] or larger
  assert.ok(
    src.includes("text-[13px]"),
    "Expected description text to be at least 13px (text-[13px])",
  );
});

void test("CompanySummary: description uses proper secondary text color for dark mode", () => {
  // Per DESIGN.md, secondary text in dark mode should be zinc-400 (#A1A1AA)
  assert.ok(
    src.includes("dark:text-zinc-400"),
    "Expected dark mode secondary text color dark:text-zinc-400",
  );
});

void test("CompanySummary: description uses proper secondary text color for light mode", () => {
  // Per DESIGN.md, secondary text in light mode should be zinc-500 (#71717A)
  assert.ok(
    src.includes("text-zinc-500"),
    "Expected light mode secondary text color text-zinc-500",
  );
});

void test("CompanySummary: description does not use muted-foreground/60", () => {
  // The old extremely faint color class should be removed
  assert.ok(
    !src.includes("muted-foreground/60"),
    "Expected muted-foreground/60 to be removed — it's too faint to read",
  );
});

void test("CompanySummary: description supports multi-line clamp", () => {
  // Should use line-clamp-2 instead of truncate to allow 2 readable lines
  assert.ok(
    src.includes("line-clamp-2"),
    "Expected line-clamp-2 for readable multi-line description",
  );
});

void test("CompanySummary: company header remains compact", () => {
  // The company summary container should not add excessive vertical spacing
  // It should still use items-center for a compact strip layout
  assert.ok(
    src.includes("items-center"),
    "Expected items-center for compact header layout",
  );
});
