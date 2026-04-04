import { describe, expect, it } from "vitest";
import { deduplicateSpecialistOutputs } from "../../../apps/desktop/src/features/agents/lib/deduplicate-specialist-outputs";
import type { ArtifactRecord } from "@opengoat/contracts";

function makeArtifact(overrides: Partial<ArtifactRecord> & { title: string; createdAt: string }): ArtifactRecord {
  return {
    id: Math.random().toString(36).slice(2),
    projectId: "proj-1",
    type: "document",
    title: overrides.title,
    content: "",
    status: "published",
    createdBy: "specialist-1",
    createdAt: overrides.createdAt,
    updatedAt: overrides.createdAt,
    ...overrides,
  } as ArtifactRecord;
}

describe("deduplicateSpecialistOutputs", () => {
  it("removes exact duplicate titles, keeping the most recent", () => {
    const artifacts = [
      makeArtifact({ title: "Page Outline", createdAt: "2025-01-01T00:00:00Z" }),
      makeArtifact({ title: "Page Outline", createdAt: "2025-01-02T00:00:00Z" }),
    ];
    const result = deduplicateSpecialistOutputs(artifacts);
    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toBe("2025-01-02T00:00:00Z");
  });

  it("removes case-insensitive duplicate titles, keeping the most recent", () => {
    const artifacts = [
      makeArtifact({ title: "Tagline Variants", createdAt: "2025-01-02T00:00:00Z" }),
      makeArtifact({ title: "Tagline variants", createdAt: "2025-01-01T00:00:00Z" }),
    ];
    const result = deduplicateSpecialistOutputs(artifacts);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Tagline Variants");
  });

  it("preserves distinct titles", () => {
    const artifacts = [
      makeArtifact({ title: "Brand Strategy", createdAt: "2025-01-01T00:00:00Z" }),
      makeArtifact({ title: "Tagline Variants", createdAt: "2025-01-02T00:00:00Z" }),
      makeArtifact({ title: "Content Calendar", createdAt: "2025-01-03T00:00:00Z" }),
    ];
    const result = deduplicateSpecialistOutputs(artifacts);
    expect(result).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateSpecialistOutputs([])).toEqual([]);
  });

  it("handles markdown in titles during dedup (strips markdown before comparing)", () => {
    const artifacts = [
      makeArtifact({ title: "**Page Outline**", createdAt: "2025-01-01T00:00:00Z" }),
      makeArtifact({ title: "Page Outline", createdAt: "2025-01-02T00:00:00Z" }),
    ];
    const result = deduplicateSpecialistOutputs(artifacts);
    expect(result).toHaveLength(1);
  });

  it("maintains original order of first occurrences after dedup", () => {
    const artifacts = [
      makeArtifact({ title: "Alpha", createdAt: "2025-01-03T00:00:00Z" }),
      makeArtifact({ title: "Beta", createdAt: "2025-01-02T00:00:00Z" }),
      makeArtifact({ title: "alpha", createdAt: "2025-01-01T00:00:00Z" }),
    ];
    const result = deduplicateSpecialistOutputs(artifacts);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Alpha");
    expect(result[1].title).toBe("Beta");
  });
});
