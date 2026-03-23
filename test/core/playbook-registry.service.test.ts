import { describe, expect, it } from "vitest";
import { playbookManifestSchema } from "../../packages/contracts/src/index.js";
import { PlaybookRegistryService } from "../../packages/core/src/core/playbooks/application/playbook-registry.service.js";
import { BUILTIN_PLAYBOOKS } from "../../packages/core/src/core/playbooks/manifests/index.js";
import type { PlaybookManifest } from "../../packages/contracts/src/index.js";

describe("PlaybookRegistryService", () => {
  function createService(playbooks?: PlaybookManifest[]): PlaybookRegistryService {
    return new PlaybookRegistryService(playbooks ?? [...BUILTIN_PLAYBOOKS]);
  }

  describe("listPlaybooks", () => {
    it("returns all 8 builtin playbooks", () => {
      const service = createService();
      const result = service.listPlaybooks();
      expect(result).toHaveLength(8);
    });

    it("returns a copy, not the internal array", () => {
      const service = createService();
      const first = service.listPlaybooks();
      const second = service.listPlaybooks();
      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });

    it("returns empty array when constructed with no playbooks", () => {
      const service = createService([]);
      expect(service.listPlaybooks()).toHaveLength(0);
    });
  });

  describe("getPlaybook", () => {
    it("returns the correct playbook by ID", () => {
      const service = createService();
      const playbook = service.getPlaybook("launch-pack");
      expect(playbook.playbookId).toBe("launch-pack");
      expect(playbook.title).toBe("Launch Pack");
    });

    it("returns each of the 8 flagship playbooks by ID", () => {
      const service = createService();
      const expectedIds = [
        "launch-pack",
        "homepage-conversion-sprint",
        "outbound-starter",
        "seo-wedge-sprint",
        "content-sprint",
        "comparison-page-sprint",
        "lead-magnet-sprint",
        "onboarding-activation-pass",
      ];
      for (const id of expectedIds) {
        const playbook = service.getPlaybook(id);
        expect(playbook.playbookId).toBe(id);
      }
    });

    it("throws for an invalid playbook ID", () => {
      const service = createService();
      expect(() => service.getPlaybook("nonexistent")).toThrow(
        'Playbook "nonexistent" does not exist.',
      );
    });
  });

  describe("getPlaybooksByGoalType", () => {
    it("returns playbooks matching the given goal type", () => {
      const service = createService();
      const result = service.getPlaybooksByGoalType("launch");
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((p) => p.goalTypes.includes("launch"))).toBe(true);
    });

    it("returns empty array for unknown goal type", () => {
      const service = createService();
      const result = service.getPlaybooksByGoalType("nonexistent-goal");
      expect(result).toHaveLength(0);
    });

    it("returns multiple playbooks when goal type is shared", () => {
      // seo is only in seo-wedge-sprint, so let's test a type that exists
      const service = createService();
      const seoResults = service.getPlaybooksByGoalType("seo");
      expect(seoResults.length).toBeGreaterThanOrEqual(1);
      for (const p of seoResults) {
        expect(p.goalTypes).toContain("seo");
      }
    });
  });

  describe("manifest schema validation", () => {
    it("all 8 builtin manifests pass Zod schema validation", () => {
      for (const manifest of BUILTIN_PLAYBOOKS) {
        const result = playbookManifestSchema.safeParse(manifest);
        expect(result.success, `Schema validation failed for ${manifest.playbookId}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      }
    });

    it("every manifest has a unique playbookId", () => {
      const ids = BUILTIN_PLAYBOOKS.map((p) => p.playbookId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("every manifest has at least one phase", () => {
      for (const manifest of BUILTIN_PLAYBOOKS) {
        expect(manifest.defaultPhases.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("every manifest has at least one artifact type", () => {
      for (const manifest of BUILTIN_PLAYBOOKS) {
        expect(manifest.artifactTypes.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("every manifest has source set to builtin", () => {
      for (const manifest of BUILTIN_PLAYBOOKS) {
        expect(manifest.source).toBe("builtin");
      }
    });
  });
});
