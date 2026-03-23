import { describe, expect, it } from "vitest";
import {
  getValidNextArtifactStatuses,
  isTerminalArtifactStatus,
  validateArtifactStatusTransition,
  VALID_ARTIFACT_TRANSITIONS,
} from "../../packages/core/src/core/artifacts/domain/artifact-status-machine.js";
import { ARTIFACT_STATUSES } from "../../packages/core/src/core/artifacts/domain/artifact.js";

describe("artifact-status-machine", () => {
  describe("validateArtifactStatusTransition", () => {
    // Valid transitions
    it("draft -> ready_for_review succeeds", () => {
      expect(() =>
        validateArtifactStatusTransition("draft", "ready_for_review"),
      ).not.toThrow();
    });

    it("draft -> archived succeeds", () => {
      expect(() =>
        validateArtifactStatusTransition("draft", "archived"),
      ).not.toThrow();
    });

    it("ready_for_review -> approved succeeds", () => {
      expect(() =>
        validateArtifactStatusTransition("ready_for_review", "approved"),
      ).not.toThrow();
    });

    it("ready_for_review -> needs_changes succeeds", () => {
      expect(() =>
        validateArtifactStatusTransition("ready_for_review", "needs_changes"),
      ).not.toThrow();
    });

    it("ready_for_review -> archived succeeds", () => {
      expect(() =>
        validateArtifactStatusTransition("ready_for_review", "archived"),
      ).not.toThrow();
    });

    it("needs_changes -> ready_for_review succeeds", () => {
      expect(() =>
        validateArtifactStatusTransition("needs_changes", "ready_for_review"),
      ).not.toThrow();
    });

    it("needs_changes -> archived succeeds", () => {
      expect(() =>
        validateArtifactStatusTransition("needs_changes", "archived"),
      ).not.toThrow();
    });

    it("approved -> archived succeeds", () => {
      expect(() =>
        validateArtifactStatusTransition("approved", "archived"),
      ).not.toThrow();
    });

    // Invalid transitions
    it("draft -> approved throws", () => {
      expect(() =>
        validateArtifactStatusTransition("draft", "approved"),
      ).toThrow('Invalid artifact status transition from "draft" to "approved"');
    });

    it("draft -> needs_changes throws", () => {
      expect(() =>
        validateArtifactStatusTransition("draft", "needs_changes"),
      ).toThrow(
        'Invalid artifact status transition from "draft" to "needs_changes"',
      );
    });

    it("approved -> ready_for_review throws", () => {
      expect(() =>
        validateArtifactStatusTransition("approved", "ready_for_review"),
      ).toThrow(
        'Invalid artifact status transition from "approved" to "ready_for_review"',
      );
    });

    it("approved -> needs_changes throws", () => {
      expect(() =>
        validateArtifactStatusTransition("approved", "needs_changes"),
      ).toThrow(
        'Invalid artifact status transition from "approved" to "needs_changes"',
      );
    });

    it("archived -> anything throws (terminal)", () => {
      for (const status of ARTIFACT_STATUSES) {
        if (status === "archived") continue;
        expect(() =>
          validateArtifactStatusTransition("archived", status),
        ).toThrow(`Invalid artifact status transition from "archived" to "${status}"`);
      }
    });

    it("any status -> archived is always allowed (except from archived)", () => {
      for (const status of ARTIFACT_STATUSES) {
        if (status === "archived") continue;
        expect(() =>
          validateArtifactStatusTransition(status, "archived"),
        ).not.toThrow();
      }
    });
  });

  describe("getValidNextArtifactStatuses", () => {
    it("returns 2 statuses for draft", () => {
      const next = getValidNextArtifactStatuses("draft");
      expect(next).toHaveLength(2);
      expect(next).toContain("ready_for_review");
      expect(next).toContain("archived");
    });

    it("returns 3 statuses for ready_for_review", () => {
      const next = getValidNextArtifactStatuses("ready_for_review");
      expect(next).toHaveLength(3);
      expect(next).toContain("approved");
      expect(next).toContain("needs_changes");
      expect(next).toContain("archived");
    });

    it("returns 2 statuses for needs_changes", () => {
      const next = getValidNextArtifactStatuses("needs_changes");
      expect(next).toHaveLength(2);
      expect(next).toContain("ready_for_review");
      expect(next).toContain("archived");
    });

    it("returns 1 status for approved", () => {
      const next = getValidNextArtifactStatuses("approved");
      expect(next).toHaveLength(1);
      expect(next).toContain("archived");
    });

    it("returns empty array for archived (terminal)", () => {
      expect(getValidNextArtifactStatuses("archived")).toHaveLength(0);
    });
  });

  describe("isTerminalArtifactStatus", () => {
    it("returns true for archived", () => {
      expect(isTerminalArtifactStatus("archived")).toBe(true);
    });

    it("returns false for draft", () => {
      expect(isTerminalArtifactStatus("draft")).toBe(false);
    });

    it("returns false for approved", () => {
      expect(isTerminalArtifactStatus("approved")).toBe(false);
    });

    it("returns false for ready_for_review", () => {
      expect(isTerminalArtifactStatus("ready_for_review")).toBe(false);
    });

    it("returns false for needs_changes", () => {
      expect(isTerminalArtifactStatus("needs_changes")).toBe(false);
    });
  });

  describe("VALID_ARTIFACT_TRANSITIONS", () => {
    it("covers all statuses", () => {
      for (const status of ARTIFACT_STATUSES) {
        expect(VALID_ARTIFACT_TRANSITIONS).toHaveProperty(status);
      }
    });
  });
});
