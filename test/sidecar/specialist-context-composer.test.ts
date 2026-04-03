import { describe, expect, it } from "vitest";
import {
  composeSpecialistContext,
  type SpecialistContextInput,
} from "../../packages/sidecar/src/context-composer/specialist-context-composer.ts";

describe("composeSpecialistContext", () => {
  it("returns empty string when there are no memories and no instructionTemplate", () => {
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

  it("renders instructionTemplate with memories", () => {
    const input: SpecialistContextInput = {
      instructionTemplate: "You are the SEO specialist.\nFocus on organic traffic.",
      memories: [
        { content: "Prioritize long-tail keywords" },
      ],
      specialistName: "SEO / AEO",
    };

    const result = composeSpecialistContext(input);

    expect(result).toContain("<specialist-context>");
    expect(result).toContain("</specialist-context>");
    expect(result).toContain("## Specialist Instructions — SEO / AEO");
    expect(result).toContain("You are the SEO specialist.\nFocus on organic traffic.");
    expect(result).toContain("## Specialist Guidelines — SEO / AEO");
    expect(result).toContain("- Prioritize long-tail keywords");
  });

  it("renders instructionTemplate without memories", () => {
    const input: SpecialistContextInput = {
      instructionTemplate: "You are the Market Intel specialist.",
      memories: [],
      specialistName: "Market Intel",
    };

    const result = composeSpecialistContext(input);

    expect(result).toContain("<specialist-context>");
    expect(result).toContain("</specialist-context>");
    expect(result).toContain("## Specialist Instructions — Market Intel");
    expect(result).toContain("You are the Market Intel specialist.");
    expect(result).not.toContain("## Specialist Guidelines");
  });

  it("renders memories without instructionTemplate (backward compat)", () => {
    const input: SpecialistContextInput = {
      memories: [{ content: "Always cite sources" }],
      specialistName: "Content",
    };

    const result = composeSpecialistContext(input);

    expect(result).toContain("<specialist-context>");
    expect(result).toContain("## Specialist Guidelines — Content");
    expect(result).toContain("- Always cite sources");
    expect(result).not.toContain("## Specialist Instructions");
  });

  it("places instructions before guidelines in output", () => {
    const input: SpecialistContextInput = {
      instructionTemplate: "Instructions here",
      memories: [{ content: "Guideline here" }],
      specialistName: "Test",
    };

    const result = composeSpecialistContext(input);

    const instructionsIdx = result.indexOf("## Specialist Instructions");
    const guidelinesIdx = result.indexOf("## Specialist Guidelines");
    expect(instructionsIdx).toBeLessThan(guidelinesIdx);
  });
});
