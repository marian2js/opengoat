import { describe, expect, it } from "vitest";
import {
  SPECIALIST_META,
  getSpecialistMeta,
} from "../../apps/desktop/src/features/agents/specialist-meta";

describe("SPECIALIST_META", () => {
  it("contains all 8 specialists", () => {
    const ids = Object.keys(SPECIALIST_META);
    expect(ids).toHaveLength(8);
    expect(ids).toContain("cmo");
    expect(ids).toContain("market-intel");
    expect(ids).toContain("positioning");
    expect(ids).toContain("website-conversion");
    expect(ids).toContain("seo-aeo");
    expect(ids).toContain("distribution");
    expect(ids).toContain("content");
    expect(ids).toContain("outbound");
  });

  it("each entry has name, role, and icon", () => {
    for (const [id, meta] of Object.entries(SPECIALIST_META)) {
      expect(meta.name, `${id} should have a name`).toBeTruthy();
      expect(meta.role, `${id} should have a role`).toBeTruthy();
      expect(meta.icon, `${id} should have an icon`).toBeTruthy();
    }
  });
});

describe("getSpecialistMeta", () => {
  it("returns metadata for a known specialist", () => {
    const meta = getSpecialistMeta("market-intel");
    expect(meta).toBeDefined();
    expect(meta!.name).toBe("Market Intel");
    expect(meta!.role).toBeTruthy();
    expect(meta!.icon).toBe("search");
  });

  it("returns undefined for an unknown specialist", () => {
    expect(getSpecialistMeta("nonexistent")).toBeUndefined();
  });

  it("returns CMO metadata", () => {
    const meta = getSpecialistMeta("cmo");
    expect(meta).toBeDefined();
    expect(meta!.name).toBe("CMO");
    expect(meta!.icon).toBe("brain");
  });
});
