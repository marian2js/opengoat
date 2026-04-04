import { describe, expect, it } from "vitest";
import { matchArtifactsToExpected } from "../../packages/core/src/core/playbooks/application/artifact-phase-matcher.js";
import type { ArtifactRecord } from "../../packages/core/src/core/artifacts/domain/artifact.js";

function makeArtifact(title: string): ArtifactRecord {
  return {
    artifactId: `art-${Math.random().toString(36).slice(2, 8)}`,
    projectId: "project-1",
    type: "report",
    title,
    status: "draft",
    format: "markdown",
    contentRef: "ref-1",
    version: 1,
    createdBy: "distribution",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
  };
}

describe("artifact-phase-matcher", () => {
  describe("matchArtifactsToExpected", () => {
    it("exact title match finds artifact", () => {
      const artifacts = [makeArtifact("community shortlist")];
      const result = matchArtifactsToExpected(artifacts, ["community shortlist"]);

      expect(result.matched.size).toBe(1);
      expect(result.matched.get("community shortlist")?.title).toBe("community shortlist");
      expect(result.missing).toEqual([]);
    });

    it("fuzzy match with token overlap >= 50% finds artifact", () => {
      // Heading "Community Shortlist for PH Launch" has tokens: community, shortlist, for, ph, launch
      // Expected "community shortlist" has tokens: community, shortlist
      // Overlap: 2/2 = 100%
      const artifacts = [makeArtifact("Community Shortlist for PH Launch")];
      const result = matchArtifactsToExpected(artifacts, ["community shortlist"]);

      expect(result.matched.size).toBe(1);
      expect(result.missing).toEqual([]);
    });

    it("low overlap (< 50%) does not match", () => {
      // "SEO report analysis" tokens: seo, report, analysis
      // "community shortlist" tokens: community, shortlist
      // Overlap: 0/2 = 0%
      const artifacts = [makeArtifact("SEO report analysis")];
      const result = matchArtifactsToExpected(artifacts, ["community shortlist"]);

      expect(result.matched.size).toBe(0);
      expect(result.missing).toEqual(["community shortlist"]);
    });

    it("all expected artifacts matched -> missing is empty", () => {
      const artifacts = [
        makeArtifact("community shortlist"),
        makeArtifact("launch timing plan"),
      ];
      const result = matchArtifactsToExpected(artifacts, [
        "community shortlist",
        "launch timing plan",
      ]);

      expect(result.matched.size).toBe(2);
      expect(result.missing).toEqual([]);
    });

    it("partial match -> correct missing list returned", () => {
      const artifacts = [makeArtifact("community shortlist")];
      const result = matchArtifactsToExpected(artifacts, [
        "community shortlist",
        "launch timing plan",
      ]);

      expect(result.matched.size).toBe(1);
      expect(result.missing).toEqual(["launch timing plan"]);
    });

    it("empty artifacts list -> all expected are missing", () => {
      const result = matchArtifactsToExpected([], [
        "community shortlist",
        "launch timing plan",
      ]);

      expect(result.matched.size).toBe(0);
      expect(result.missing).toEqual(["community shortlist", "launch timing plan"]);
    });

    it("case-insensitive matching works", () => {
      const artifacts = [makeArtifact("COMMUNITY SHORTLIST")];
      const result = matchArtifactsToExpected(artifacts, ["community shortlist"]);

      expect(result.matched.size).toBe(1);
      expect(result.missing).toEqual([]);
    });

    it("empty expected list returns no matches and no missing", () => {
      const artifacts = [makeArtifact("community shortlist")];
      const result = matchArtifactsToExpected(artifacts, []);

      expect(result.matched.size).toBe(0);
      expect(result.missing).toEqual([]);
    });

    it("artifact with extra punctuation still matches", () => {
      const artifacts = [makeArtifact("Product Hunt — Copy Draft")];
      const result = matchArtifactsToExpected(artifacts, ["Product Hunt copy"]);

      // "product hunt copy draft" tokens from heading: product, hunt, copy, draft
      // "product hunt copy" tokens: product, hunt, copy
      // Overlap: 3/3 = 100%
      expect(result.matched.size).toBe(1);
      expect(result.missing).toEqual([]);
    });
  });
});
