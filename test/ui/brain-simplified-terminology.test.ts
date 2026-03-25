import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(desktopSrc, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// AC1: Brain UI labels use simplified terminology
// ---------------------------------------------------------------------------
describe("Brain simplified terminology — navigation labels", () => {
  it('sidebar label "Memory" is renamed to "Company Context"', () => {
    const nav = readSrc("app/config/navigation.ts");
    expect(nav).toContain('"Company Context"');
    expect(nav).not.toMatch(/title:\s*"Memory"/);
  });

  it('sidebar label "Operating Memory" is renamed to "Saved Guidance"', () => {
    const nav = readSrc("app/config/navigation.ts");
    expect(nav).toContain('"Saved Guidance"');
    expect(nav).not.toContain('"Operating Memory"');
  });

  it('sidebar label "Knowledge" is renamed to "Knowledge Base"', () => {
    const nav = readSrc("app/config/navigation.ts");
    expect(nav).toContain('"Knowledge Base"');
  });

  it("href paths remain unchanged for routing stability", () => {
    const nav = readSrc("app/config/navigation.ts");
    expect(nav).toContain("#brain/memory");
    expect(nav).toContain("#brain/operating-memory");
    expect(nav).toContain("#brain/knowledge");
  });
});

// ---------------------------------------------------------------------------
// AC2: BRAIN_SECTIONS in BrainWorkspace use simplified labels/descriptions
// ---------------------------------------------------------------------------
describe("Brain simplified terminology — BRAIN_SECTIONS", () => {
  const src = readSrc("features/brain/components/BrainWorkspace.tsx");

  it('memory section label is "Company Context"', () => {
    const memoryIdx = src.indexOf('id: "memory"');
    expect(memoryIdx).toBeGreaterThan(0);
    const sectionSlice = src.slice(memoryIdx, memoryIdx + 300);
    expect(sectionSlice).toContain('label: "Company Context"');
  });

  it('operating-memory section label is "Saved Guidance"', () => {
    const opMemIdx = src.indexOf('id: "operating-memory"');
    expect(opMemIdx).toBeGreaterThan(0);
    const sectionSlice = src.slice(opMemIdx, opMemIdx + 300);
    expect(sectionSlice).toContain('label: "Saved Guidance"');
  });

  it('knowledge section label is "Knowledge Base"', () => {
    const knowIdx = src.indexOf('id: "knowledge"');
    expect(knowIdx).toBeGreaterThan(0);
    const sectionSlice = src.slice(knowIdx, knowIdx + 300);
    expect(sectionSlice).toContain('label: "Knowledge Base"');
  });

  it("operating-memory description mentions alignment, not memory jargon", () => {
    const opMemIdx = src.indexOf('id: "operating-memory"');
    const sectionSlice = src.slice(opMemIdx, opMemIdx + 300);
    expect(sectionSlice).toContain("stay aligned");
  });
});

// ---------------------------------------------------------------------------
// AC3: OperatingMemorySection uses simplified copy
// ---------------------------------------------------------------------------
describe("Brain simplified terminology — OperatingMemorySection", () => {
  const src = readSrc("features/brain/components/OperatingMemorySection.tsx");

  it('empty state heading is "No saved guidance yet"', () => {
    expect(src).toContain("No saved guidance yet");
    expect(src).not.toContain("Project memory is empty");
  });

  it("empty state description uses non-demanding language", () => {
    // Description should use helpful framing, not demanding language
    expect(src).toMatch(/Help|stay aligned|optional|not required/);
  });

  it('CTA button says "Add your first entry" not "Add your first memory"', () => {
    expect(src).toContain("Add your first entry");
    expect(src).not.toMatch(/Add your first memory/);
  });

  it('delete dialog title says "Delete entry" not "Delete memory entry"', () => {
    expect(src).toContain("Delete entry");
    expect(src).not.toContain("Delete memory entry");
  });
});

// ---------------------------------------------------------------------------
// AC4: MemoryCategoryGroup uses simplified label
// ---------------------------------------------------------------------------
describe("Brain simplified terminology — MemoryCategoryGroup", () => {
  it('"Add memory" button is renamed to "Add entry"', () => {
    const src = readSrc("features/brain/components/MemoryCategoryGroup.tsx");
    expect(src).toContain("Add entry");
    expect(src).not.toContain("Add memory");
  });
});

// ---------------------------------------------------------------------------
// AC5: MemoryEntryForm uses simplified placeholder
// ---------------------------------------------------------------------------
describe("Brain simplified terminology — MemoryEntryForm", () => {
  it('placeholder says "What should the system know?" instead of "remember"', () => {
    const src = readSrc("features/brain/components/MemoryEntryForm.tsx");
    expect(src).toContain("What should the system know?");
    expect(src).not.toContain("What should the system remember?");
  });
});

// ---------------------------------------------------------------------------
// AC6: MemoryConflictDialog uses simplified copy
// ---------------------------------------------------------------------------
describe("Brain simplified terminology — MemoryConflictDialog", () => {
  it('says "existing entry" instead of "existing memory entry"', () => {
    const src = readSrc("features/brain/components/MemoryConflictDialog.tsx");
    expect(src).toContain("existing entry");
    expect(src).not.toContain("existing memory entry");
  });
});

// ---------------------------------------------------------------------------
// AC7: MemoryCandidateChip uses "Saved to Brain"
// ---------------------------------------------------------------------------
describe("Brain simplified terminology — MemoryCandidateChip", () => {
  it('"Saved to memory" is replaced with "Saved to Brain"', () => {
    const src = readSrc("features/chat/components/MemoryCandidateChip.tsx");
    expect(src).toContain("Saved to Brain");
    expect(src).not.toContain("Saved to memory");
  });
});

// ---------------------------------------------------------------------------
// AC8: ObjectiveMemoryTab uses simplified copy
// ---------------------------------------------------------------------------
describe("Brain simplified terminology — ObjectiveMemoryTab", () => {
  const src = readSrc("features/objectives/components/ObjectiveMemoryTab.tsx");

  it('empty state heading says "No objective context yet"', () => {
    expect(src).toContain("No objective context yet");
    expect(src).not.toContain("No objective memories yet");
  });

  it('CTA says "Add your first entry"', () => {
    expect(src).toContain("Add your first entry");
    expect(src).not.toMatch(/Add your first memory/);
  });

  it('delete dialog says "Delete entry"', () => {
    expect(src).toContain("Delete entry");
    expect(src).not.toContain("Delete memory entry");
  });
});

// ---------------------------------------------------------------------------
// AC9: Brain does not feel required — empty state communicates enhancement
// ---------------------------------------------------------------------------
describe("Brain simplified terminology — not-required messaging", () => {
  it("OperatingMemorySection empty state uses non-urgent language", () => {
    const src = readSrc("features/brain/components/OperatingMemorySection.tsx");
    // Empty state should not use demanding language — uses helpful framing instead
    expect(src).toMatch(/Help|stay aligned|optional|not required/);
  });

  it("BrainWorkspace memory empty state uses non-urgent language", () => {
    const src = readSrc("features/brain/components/BrainWorkspace.tsx");
    // The MemoryEmptyState should not use urgent language
    expect(src).not.toContain("Build your AI's memory");
  });
});
