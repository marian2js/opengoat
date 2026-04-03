import { describe, expect, it } from "vitest";
import { getSpecialistMeta } from "../../apps/desktop/src/features/agents/specialist-meta";

/**
 * Tests for sidebar specialist badge logic.
 * We test the data lookup that drives badge rendering in SessionItem.
 */
describe("Sidebar specialist badge logic", () => {
  it("returns specialist name for sessions with specialistId", () => {
    const specialistId = "market-intel";
    const meta = getSpecialistMeta(specialistId);
    expect(meta).toBeDefined();
    expect(meta!.name).toBe("Market Intel");
  });

  it("returns undefined for sessions without specialistId", () => {
    const specialistId: string | undefined = undefined;
    const meta = specialistId ? getSpecialistMeta(specialistId) : undefined;
    expect(meta).toBeUndefined();
  });

  it("returns correct names for all specialists", () => {
    const expected: Record<string, string> = {
      cmo: "CMO",
      "market-intel": "Market Intel",
      positioning: "Positioning",
      "website-conversion": "Website Conversion",
      "seo-aeo": "SEO/AEO",
      distribution: "Distribution",
      content: "Content",
      outbound: "Outbound",
    };

    for (const [id, name] of Object.entries(expected)) {
      const meta = getSpecialistMeta(id);
      expect(meta?.name, `${id} name should be ${name}`).toBe(name);
    }
  });
});
