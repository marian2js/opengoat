import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(import.meta.dirname, "CompanyUnderstandingHero.tsx"),
  "utf-8",
);

void test("CompanyUnderstandingHero: description text uses readable sizes", () => {
  // The description paragraph should use text-[15px] for full summary or text-[13px] for fallback
  assert.ok(
    src.includes("text-[15px]") || src.includes("text-[13px]"),
    "Expected description text to be at least 13px",
  );
});

void test("CompanyUnderstandingHero: description uses proper secondary text color for dark mode", () => {
  // Per DESIGN.md, secondary text in dark mode should be zinc-400 (#A1A1AA)
  assert.ok(
    src.includes("dark:text-zinc-400"),
    "Expected dark mode secondary text color dark:text-zinc-400",
  );
});

void test("CompanyUnderstandingHero: description uses proper secondary text color for light mode", () => {
  // Per DESIGN.md, secondary text in light mode should be zinc-500 (#71717A)
  assert.ok(
    src.includes("text-zinc-500"),
    "Expected light mode secondary text color text-zinc-500",
  );
});

void test("CompanyUnderstandingHero: description does not use muted-foreground/60", () => {
  // The old extremely faint color class should be removed
  assert.ok(
    !src.includes("muted-foreground/60"),
    "Expected muted-foreground/60 to be removed — it's too faint to read",
  );
});

void test("CompanyUnderstandingHero: description supports multi-line clamp", () => {
  // Should use line-clamp for readable multi-line description
  assert.ok(
    src.includes("line-clamp-3"),
    "Expected line-clamp-3 for readable multi-line description",
  );
});

void test("CompanyUnderstandingHero: company header remains compact", () => {
  // The company identity strip should use items-center for a compact layout
  assert.ok(
    src.includes("items-center"),
    "Expected items-center for compact header layout",
  );
});
