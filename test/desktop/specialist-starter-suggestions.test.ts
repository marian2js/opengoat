import { describe, it, expect } from "vitest";
import { SPECIALIST_META, getSpecialistMeta } from "../../apps/desktop/src/features/agents/specialist-meta";

describe("specialist-meta starterSuggestions", () => {
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

  it("all 8 specialists have starterSuggestions", () => {
    for (const id of specialistIds) {
      const meta = SPECIALIST_META[id];
      expect(meta).toBeDefined();
      expect(meta.starterSuggestions).toBeDefined();
      expect(meta.starterSuggestions).toHaveLength(3);
    }
  });

  it("each specialist has unique suggestions (no duplicates within a specialist)", () => {
    for (const id of specialistIds) {
      const meta = SPECIALIST_META[id];
      const unique = new Set(meta.starterSuggestions);
      expect(unique.size).toBe(3);
    }
  });

  it("no two specialists share the same suggestion", () => {
    const allSuggestions = Object.values(SPECIALIST_META).flatMap((m) => m.starterSuggestions);
    const unique = new Set(allSuggestions);
    expect(unique.size).toBe(allSuggestions.length);
  });

  it("getSpecialistMeta returns suggestions for known specialist", () => {
    const meta = getSpecialistMeta("positioning");
    expect(meta).toBeDefined();
    expect(meta!.starterSuggestions).toHaveLength(3);
    expect(meta!.starterSuggestions[0]).toContain("one-liner");
  });

  it("getSpecialistMeta returns undefined for unknown specialist", () => {
    const meta = getSpecialistMeta("nonexistent");
    expect(meta).toBeUndefined();
  });
});
