import { describe, it, expect } from "vitest";
import { specialistAgentSchema } from "@opengoat/contracts";
import {
  SPECIALIST_ROSTER,
  getSpecialistRoster,
  getSpecialistById,
} from "./specialist-registry.ts";

describe("specialist-registry", () => {
  it("contains exactly 8 specialists", () => {
    expect(SPECIALIST_ROSTER).toHaveLength(8);
    expect(getSpecialistRoster()).toHaveLength(8);
  });

  it("each specialist has all required fields populated", () => {
    for (const specialist of SPECIALIST_ROSTER) {
      expect(specialist.id).toBeTruthy();
      expect(specialist.name).toBeTruthy();
      expect(specialist.role).toBeTruthy();
      expect(specialist.description).toBeTruthy();
      expect(specialist.reasonToExist).toBeTruthy();
      expect(specialist.outputTypes.length).toBeGreaterThan(0);
      expect(specialist.icon).toBeTruthy();
      expect(specialist.category).toBeTruthy();
      expect(specialist.instructionTemplate).toBeTruthy();
    }
  });

  it("each specialist validates against the Zod schema", () => {
    for (const specialist of SPECIALIST_ROSTER) {
      const result = specialistAgentSchema.safeParse(specialist);
      expect(result.success).toBe(true);
    }
  });

  it("CMO has category 'manager', others have 'specialist'", () => {
    const cmo = SPECIALIST_ROSTER.find((s) => s.id === "cmo");
    expect(cmo).toBeDefined();
    expect(cmo!.category).toBe("manager");

    const nonCmo = SPECIALIST_ROSTER.filter((s) => s.id !== "cmo");
    expect(nonCmo).toHaveLength(7);
    for (const specialist of nonCmo) {
      expect(specialist.category).toBe("specialist");
    }
  });

  it("all IDs are unique", () => {
    const ids = SPECIALIST_ROSTER.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getSpecialistById returns correct agent", () => {
    const cmo = getSpecialistById("cmo");
    expect(cmo).toBeDefined();
    expect(cmo!.name).toBe("CMO");
  });

  it("getSpecialistById returns undefined for unknown id", () => {
    const result = getSpecialistById("nonexistent");
    expect(result).toBeUndefined();
  });

  it("each specialist has non-empty outputTypes", () => {
    for (const specialist of SPECIALIST_ROSTER) {
      expect(specialist.outputTypes.length).toBeGreaterThanOrEqual(3);
      for (const output of specialist.outputTypes) {
        expect(output.length).toBeGreaterThan(0);
      }
    }
  });

  it("instructionTemplate is substantial (at least 5 lines)", () => {
    for (const specialist of SPECIALIST_ROSTER) {
      const lines = specialist.instructionTemplate.split("\n").filter((l) => l.trim().length > 0);
      expect(lines.length).toBeGreaterThanOrEqual(5);
    }
  });
});
