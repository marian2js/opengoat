import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/agents/components/SpecialistCard.tsx",
  ),
  "utf-8",
);

describe("Idle specialist suggested first action", () => {
  it("does not show generic 'Start your first conversation' text", () => {
    expect(src).not.toMatch(/Start your first conversation/);
  });

  it("uses specialist.outputTypes[0] to generate a specific suggestion", () => {
    expect(src).toMatch(/specialist\.outputTypes\[0\]/);
  });

  it("includes a 'Try:' prefix label", () => {
    expect(src).toMatch(/Try:/);
  });

  it("calls onChat when the suggestion is clicked", () => {
    expect(src).toMatch(/!hasOutputs\s*&&\s*!isManager[\s\S]*?onChat\(specialist\.id\)/);
  });

  it("still renders the recent outputs section for cards with outputs", () => {
    expect(src).toMatch(/hasOutputs/);
    expect(src).toMatch(/Recent outputs/);
  });

  it("only appears for non-manager specialists without outputs", () => {
    expect(src).toMatch(/!hasOutputs\s*&&\s*!isManager/);
  });
});
