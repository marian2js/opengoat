import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const agentsDir = resolve(
  __dirname,
  "../../../apps/desktop/src/features/agents",
);
const readSrc = (path: string) =>
  readFileSync(resolve(agentsDir, path), "utf-8");

const specialistCardSrc = readSrc("components/SpecialistCard.tsx");

// ---------------------------------------------------------------------------
// Activity status — "ACTIVE" badge for specialists with recent (24h) outputs
// ---------------------------------------------------------------------------
describe("SpecialistCard activity status badge", () => {
  it("checks whether outputs are recent (within 24 hours)", () => {
    // Should have logic comparing output timestamps to determine recency
    expect(specialistCardSrc).toMatch(/24\s*\*\s*60\s*\*\s*60\s*\*\s*1000|86[_,]?400[_,]?000/);
  });

  it("renders an ACTIVE badge for specialists with recent activity", () => {
    expect(specialistCardSrc).toContain("ACTIVE");
  });

  it("uses emerald accent for the active badge", () => {
    // The active badge should use primary/emerald styling
    expect(specialistCardSrc).toMatch(/bg-primary|bg-emerald/);
  });

  it("uses monospace font for the active badge (consistent with LEAD badge)", () => {
    // Active badge should use same styling pattern as the LEAD badge
    expect(specialistCardSrc).toMatch(/font-mono.*ACTIVE|ACTIVE.*font-mono/s);
  });

  it("only shows ACTIVE badge on non-manager specialists", () => {
    // Should check isManager before rendering the ACTIVE badge
    // The ACTIVE badge should be in a conditional that excludes managers
    expect(specialistCardSrc).toMatch(/!isManager.*ACTIVE/s);
  });
});

// ---------------------------------------------------------------------------
// Activity status — "Start your first conversation" for unused specialists
// ---------------------------------------------------------------------------
describe("SpecialistCard unused specialist prompt", () => {
  it("renders a prompt for unused specialists", () => {
    expect(specialistCardSrc).toMatch(/Start your first conversation/i);
  });

  it("uses muted styling for the unused prompt", () => {
    // Should use muted-foreground or similar subdued styling
    expect(specialistCardSrc).toMatch(/text-muted-foreground/);
  });

  it("uses monospace font for the unused prompt", () => {
    expect(specialistCardSrc).toMatch(/font-mono.*Start your first conversation|Start your first conversation.*font-mono/si);
  });

  it("only shows unused prompt when there are no outputs (not on managers)", () => {
    // Should conditionally render based on hasOutputs being false
    expect(specialistCardSrc).toMatch(/!hasOutputs|hasOutputs.*false/s);
  });
});
