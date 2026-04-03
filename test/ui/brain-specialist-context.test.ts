import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(desktopSrc, relativePath), "utf-8");
}

describe("SpecialistContextSection component", () => {
  const filePath = "features/brain/components/SpecialistContextSection.tsx";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports SpecialistContextSection component", () => {
    const src = readSrc(filePath);
    expect(src).toContain("export function SpecialistContextSection");
  });

  it("accepts agentId and client props", () => {
    const src = readSrc(filePath);
    expect(src).toContain("agentId");
    expect(src).toContain("client");
  });

  it("fetches specialist roster", () => {
    const src = readSrc(filePath);
    expect(src).toContain("specialists");
  });

  it("displays specialist name in 'How [Name] Should Work' format", () => {
    const src = readSrc(filePath);
    expect(src).toContain("How");
    expect(src).toContain("Should Work");
  });

  it("uses specialist_context category for memory operations", () => {
    const src = readSrc(filePath);
    expect(src).toContain("specialist_context");
  });

  it("provides collapsible groups for each specialist", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/[Cc]ollaps/);
  });

  it("has an add-guidelines mechanism for specialists without entries", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/[Aa]dd/);
  });

  it("reuses MemoryEntryCard and MemoryEntryForm", () => {
    const src = readSrc(filePath);
    expect(src).toContain("MemoryEntryCard");
    expect(src).toContain("MemoryEntryForm");
  });
});

describe("useSpecialistContext hook", () => {
  const filePath = "features/brain/hooks/useSpecialistContext.ts";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports useSpecialistContext function", () => {
    const src = readSrc(filePath);
    expect(src).toContain("export function useSpecialistContext");
  });

  it("queries for specialist_context category", () => {
    const src = readSrc(filePath);
    expect(src).toContain("specialist_context");
  });

  it("groups entries by specialistId", () => {
    const src = readSrc(filePath);
    expect(src).toContain("specialistId");
  });
});

describe("BrainWorkspace includes specialist-context section", () => {
  const filePath = "features/brain/components/BrainWorkspace.tsx";

  it("references specialist-context section ID", () => {
    const src = readSrc(filePath);
    expect(src).toContain("specialist-context");
  });

  it("renders SpecialistContextSection", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SpecialistContextSection");
  });
});

describe("Navigation includes Agent Guidelines entry", () => {
  const filePath = "app/config/navigation.ts";

  it("has Agent Guidelines in brainNavigation", () => {
    const src = readSrc(filePath);
    expect(src).toContain("Agent Guidelines");
    expect(src).toContain("#brain/specialist-context");
  });
});
