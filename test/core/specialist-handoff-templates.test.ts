import { describe, expect, it } from "vitest";
import {
  getSpecialistById,
  getSpecialistRoster,
} from "../../packages/core/src/core/specialists/specialist-registry";

describe("CMO instruction template — specialist directory", () => {
  const cmo = getSpecialistById("cmo");

  it("CMO template includes specialist directory", () => {
    expect(cmo).toBeDefined();
    const template = cmo!.instructionTemplate;
    // Must mention all 7 specialist names
    expect(template).toContain("Market Intel");
    expect(template).toContain("Positioning");
    expect(template).toContain("Website Conversion");
    expect(template).toContain("SEO/AEO");
    expect(template).toContain("Distribution");
    expect(template).toContain("Content");
    expect(template).toContain("Outbound");
  });

  it("CMO template includes routing guidelines", () => {
    const template = cmo!.instructionTemplate;
    // Should have guidelines about when to recommend specialists
    expect(template.toLowerCase()).toMatch(/recommend|suggest|route/);
  });

  it("CMO template includes cross-functional summary guidance", () => {
    const template = cmo!.instructionTemplate;
    expect(template.toLowerCase()).toMatch(/synthesiz|cross-functional|specialist perspective/);
  });
});

describe("specialist instruction templates — handoff awareness", () => {
  const specialistIds = [
    "market-intel",
    "positioning",
    "website-conversion",
    "seo-aeo",
    "distribution",
    "content",
    "outbound",
  ];

  for (const id of specialistIds) {
    it(`${id} template mentions at least one other specialist by name`, () => {
      const specialist = getSpecialistById(id);
      expect(specialist).toBeDefined();
      const template = specialist!.instructionTemplate;

      const otherNames = [
        "Market Intel",
        "Positioning",
        "Website Conversion",
        "SEO/AEO",
        "Distribution",
        "Content Agent",
        "Outbound",
        "CMO",
      ];

      // Must reference at least one other specialist
      const mentionsOther = otherNames.some(
        (name) => template.includes(name) && name !== specialist!.name,
      );
      expect(mentionsOther).toBe(true);
    });

    it(`${id} template includes handoff phrasing`, () => {
      const specialist = getSpecialistById(id);
      expect(specialist).toBeDefined();
      const template = specialist!.instructionTemplate.toLowerCase();

      // Must include handoff-intent language that the detector can match
      const hasHandoffLanguage =
        template.includes("could help") ||
        template.includes("suggest") ||
        template.includes("hand off") ||
        template.includes("recommend") ||
        template.includes("talk to") ||
        template.includes("specializes in");
      expect(hasHandoffLanguage).toBe(true);
    });
  }
});
