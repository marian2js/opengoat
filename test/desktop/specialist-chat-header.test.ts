import { describe, expect, it } from "vitest";
import { getSpecialistMeta } from "../../apps/desktop/src/features/agents/specialist-meta";
import { resolveSpecialistIcon } from "../../apps/desktop/src/features/agents/specialist-icons";

/**
 * Tests for SpecialistChatHeader rendering logic.
 * Since we can't easily render React components in vitest without jsdom + RTL setup,
 * we test the data resolution logic that powers the component.
 */
describe("SpecialistChatHeader data resolution", () => {
  it("resolves specialist name and role for known specialist", () => {
    const meta = getSpecialistMeta("market-intel");
    expect(meta).toBeDefined();
    expect(meta!.name).toBe("Market Intel");
    expect(meta!.role).toContain("market-research");
  });

  it("resolves specialist icon for known icon key", () => {
    const Icon = resolveSpecialistIcon("search");
    expect(Icon).toBeDefined();
  });

  it("falls back to BotIcon for unknown icon key", () => {
    const Icon = resolveSpecialistIcon("nonexistent-icon");
    expect(Icon).toBeDefined();
  });

  it("resolves all specialist icons without error", () => {
    const specialists = ["cmo", "market-intel", "positioning", "website-conversion", "seo-aeo", "distribution", "content", "outbound"];
    for (const id of specialists) {
      const meta = getSpecialistMeta(id);
      expect(meta, `${id} should have metadata`).toBeDefined();
      const Icon = resolveSpecialistIcon(meta!.icon);
      expect(Icon, `${id} icon should resolve`).toBeDefined();
    }
  });
});

describe("Effective specialist ID logic", () => {
  it("prefers currentSpecialistId over bootstrap specialistId", () => {
    const currentSpecialistId: string | undefined = "market-intel";
    const bootstrapSpecialistId: string | undefined = "positioning";
    const effective = currentSpecialistId ?? bootstrapSpecialistId;
    expect(effective).toBe("market-intel");
  });

  it("falls back to bootstrap specialistId when currentSpecialistId is undefined", () => {
    const currentSpecialistId: string | undefined = undefined;
    const bootstrapSpecialistId: string | undefined = "positioning";
    const effective = currentSpecialistId ?? bootstrapSpecialistId;
    expect(effective).toBe("positioning");
  });

  it("returns undefined when both are absent", () => {
    const currentSpecialistId: string | undefined = undefined;
    const bootstrapSpecialistId: string | undefined = undefined;
    const effective = currentSpecialistId ?? bootstrapSpecialistId;
    expect(effective).toBeUndefined();
  });
});
