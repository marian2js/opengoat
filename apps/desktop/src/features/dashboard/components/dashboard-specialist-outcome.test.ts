import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const chipSrc = readFileSync(
  resolve(import.meta.dirname, "DashboardSpecialistChip.tsx"),
  "utf-8",
);

const metaSrc = readFileSync(
  resolve(import.meta.dirname, "../../../features/agents/specialist-meta.ts"),
  "utf-8",
);

void test("specialist-meta: SpecialistMeta interface includes produces field", () => {
  assert.ok(
    metaSrc.includes("produces:") || metaSrc.includes("produces :"),
    "Expected 'produces' field in SpecialistMeta interface",
  );
});

void test("specialist-meta: every specialist has a produces array", () => {
  const specialistIds = [
    "cmo",
    "market-intel",
    "positioning",
    "website-conversion",
    "seo-aeo",
    "distribution",
    "content",
    "outbound",
  ];
  for (const id of specialistIds) {
    // Find the specialist block and check it contains produces
    // Keys may be quoted or unquoted depending on whether they contain hyphens
    const hasKey = metaSrc.includes(`"${id}":`) || metaSrc.includes(`${id}:`);
    assert.ok(
      hasKey,
      `Expected specialist '${id}' in SPECIALIST_META`,
    );
  }
  // Check that produces appears at least 8 times (once per specialist)
  const producesCount = (metaSrc.match(/produces:/g) || []).length;
  assert.ok(
    producesCount >= 8,
    `Expected at least 8 'produces:' entries, found ${producesCount}`,
  );
});

void test("DashboardSpecialistChip: renders produces pills from meta", () => {
  assert.ok(
    chipSrc.includes("produces") || chipSrc.includes("meta?.produces"),
    "Expected DashboardSpecialistChip to reference 'produces' field from meta",
  );
});

void test("DashboardSpecialistChip: produces pills appear before role text", () => {
  // The produces rendering should appear before the role text in the component
  const producesIndex = chipSrc.indexOf("produces");
  const roleIndex = chipSrc.indexOf("specialist.role");
  assert.ok(
    producesIndex > 0 && roleIndex > 0 && producesIndex < roleIndex,
    "Expected 'produces' rendering to appear before 'specialist.role' in the chip component",
  );
});

void test("DashboardSpecialistChip: no longer shows bestAt as primary description", () => {
  // bestAt should either not appear or appear only after produces
  const bestAtIndex = chipSrc.indexOf("bestAt");
  const producesIndex = chipSrc.indexOf("produces");
  if (bestAtIndex >= 0) {
    assert.ok(
      producesIndex < bestAtIndex,
      "If bestAt is still rendered, produces should come first",
    );
  }
  // Either way, produces must be present
  assert.ok(producesIndex >= 0, "Expected 'produces' to be rendered in chip");
});
