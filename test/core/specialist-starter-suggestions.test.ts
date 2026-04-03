import { describe, it, expect } from "vitest";
import { specialistAgentSchema } from "../../packages/contracts/src/index";
import {
  SPECIALIST_ROSTER,
  getSpecialistById,
} from "../../packages/core/src/core/specialists/specialist-registry";

describe("specialist starter suggestions", () => {
  it("each specialist has exactly 3 starter suggestions", () => {
    for (const specialist of SPECIALIST_ROSTER) {
      expect(specialist.starterSuggestions).toHaveLength(3);
    }
  });

  it("all starter suggestions are non-empty strings", () => {
    for (const specialist of SPECIALIST_ROSTER) {
      for (const suggestion of specialist.starterSuggestions) {
        expect(typeof suggestion).toBe("string");
        expect(suggestion.length).toBeGreaterThan(0);
      }
    }
  });

  it("each specialist has unique starter suggestions (no duplicates across specialists)", () => {
    const allSuggestions = SPECIALIST_ROSTER.flatMap((s) => s.starterSuggestions);
    const uniqueSuggestions = new Set(allSuggestions);
    expect(uniqueSuggestions.size).toBe(allSuggestions.length);
  });

  it("CMO suggestions are CMO-appropriate (not generic)", () => {
    const cmo = getSpecialistById("cmo");
    expect(cmo).toBeDefined();
    expect(cmo!.starterSuggestions).not.toContain(
      "What are the top 3 growth opportunities for my product right now?"
    );
    const joined = cmo!.starterSuggestions.join(" ").toLowerCase();
    expect(
      joined.includes("marketing") || joined.includes("specialist") || joined.includes("channel")
    ).toBe(true);
  });

  it("Market Intel suggestions are about research and competitors", () => {
    const intel = getSpecialistById("market-intel");
    expect(intel).toBeDefined();
    const joined = intel!.starterSuggestions.join(" ").toLowerCase();
    expect(
      joined.includes("competitor") || joined.includes("community") || joined.includes("customer")
    ).toBe(true);
  });

  it("Positioning suggestions are about messaging and differentiation", () => {
    const pos = getSpecialistById("positioning");
    expect(pos).toBeDefined();
    const joined = pos!.starterSuggestions.join(" ").toLowerCase();
    expect(
      joined.includes("one-liner") || joined.includes("differentiation") || joined.includes("messaging")
    ).toBe(true);
  });

  it("Website Conversion suggestions are about site/conversion", () => {
    const wc = getSpecialistById("website-conversion");
    expect(wc).toBeDefined();
    const joined = wc!.starterSuggestions.join(" ").toLowerCase();
    expect(
      joined.includes("hero") || joined.includes("cta") || joined.includes("conversion") || joined.includes("site")
    ).toBe(true);
  });

  it("SEO/AEO suggestions are about search and visibility", () => {
    const seo = getSpecialistById("seo-aeo");
    expect(seo).toBeDefined();
    const joined = seo!.starterSuggestions.join(" ").toLowerCase();
    expect(
      joined.includes("seo") || joined.includes("comparison") || joined.includes("answer engine") || joined.includes("ai answer")
    ).toBe(true);
  });

  it("Distribution suggestions are about launch and channels", () => {
    const dist = getSpecialistById("distribution");
    expect(dist).toBeDefined();
    const joined = dist!.starterSuggestions.join(" ").toLowerCase();
    expect(
      joined.includes("launch") || joined.includes("product hunt") || joined.includes("channel")
    ).toBe(true);
  });

  it("Content suggestions are about content creation", () => {
    const content = getSpecialistById("content");
    expect(content).toBeDefined();
    const joined = content!.starterSuggestions.join(" ").toLowerCase();
    expect(
      joined.includes("content") || joined.includes("editorial") || joined.includes("repurpos")
    ).toBe(true);
  });

  it("Outbound suggestions are about outreach and email", () => {
    const outbound = getSpecialistById("outbound");
    expect(outbound).toBeDefined();
    const joined = outbound!.starterSuggestions.join(" ").toLowerCase();
    expect(
      joined.includes("outreach") || joined.includes("email") || joined.includes("subject line")
    ).toBe(true);
  });

  it("starterSuggestions validates against the Zod schema", () => {
    for (const specialist of SPECIALIST_ROSTER) {
      const result = specialistAgentSchema.safeParse(specialist);
      expect(result.success).toBe(true);
    }
  });
});
