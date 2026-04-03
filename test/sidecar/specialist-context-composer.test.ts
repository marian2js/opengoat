import { describe, expect, it } from "vitest";
import {
  composeSpecialistContext,
  type SpecialistContextInput,
} from "../../packages/sidecar/src/context-composer/specialist-context-composer.ts";

describe("composeSpecialistContext", () => {
  it("returns empty string when there are no memories", () => {
    const input: SpecialistContextInput = {
      memories: [],
      specialistName: "SEO / AEO",
    };

    expect(composeSpecialistContext(input)).toBe("");
  });

  it("renders a markdown block with specialist name and guidelines", () => {
    const input: SpecialistContextInput = {
      memories: [
        { content: "Prioritize long-tail keywords over brand terms" },
        { content: "Focus on comparison pages for competitors" },
      ],
      specialistName: "SEO / AEO",
    };

    const result = composeSpecialistContext(input);

    expect(result).toContain("<specialist-context>");
    expect(result).toContain("</specialist-context>");
    expect(result).toContain("## Specialist Guidelines — SEO / AEO");
    expect(result).toContain("- Prioritize long-tail keywords over brand terms");
    expect(result).toContain("- Focus on comparison pages for competitors");
  });

  it("renders a single guideline correctly", () => {
    const input: SpecialistContextInput = {
      memories: [{ content: "Use casual founder tone" }],
      specialistName: "Outbound",
    };

    const result = composeSpecialistContext(input);

    expect(result).toContain("## Specialist Guidelines — Outbound");
    expect(result).toContain("- Use casual founder tone");
  });
});
