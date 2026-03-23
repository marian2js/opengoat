import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(desktopSrc, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// Phase 1: Category mapping utility
// ---------------------------------------------------------------------------
describe("Objective memory categories utility", () => {
  const filePath = "features/objectives/lib/objective-memory-categories.ts";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports OBJECTIVE_MEMORY_CATEGORIES ordered array with all 8 categories", () => {
    const src = readSrc(filePath);
    expect(src).toContain("OBJECTIVE_MEMORY_CATEGORIES");
    expect(src).toContain("current_goal");
    expect(src).toContain("success_definition");
    expect(src).toContain("already_tried");
    expect(src).toContain("avoid");
    expect(src).toContain("current_best_hypothesis");
    expect(src).toContain("review_notes");
    expect(src).toContain("final_decisions");
    expect(src).toContain("open_questions");
  });

  it("exports OBJECTIVE_CATEGORY_DISPLAY_NAMES with human-readable labels", () => {
    const src = readSrc(filePath);
    expect(src).toContain("OBJECTIVE_CATEGORY_DISPLAY_NAMES");
    expect(src).toContain("Current Goal");
    expect(src).toContain("Success Definition");
    expect(src).toContain("Already Tried");
    expect(src).toContain("Avoid");
    expect(src).toContain("Current Best Hypothesis");
    expect(src).toContain("Review Notes");
    expect(src).toContain("Final Decisions");
    expect(src).toContain("Open Questions");
  });

  it("exports OBJECTIVE_CATEGORY_EMPTY_PROMPTS with guidance text per category", () => {
    const src = readSrc(filePath);
    expect(src).toContain("OBJECTIVE_CATEGORY_EMPTY_PROMPTS");
    expect(src).toContain("Define what this objective is trying to achieve");
    expect(src).toContain("Describe what success looks like for this objective");
    expect(src).toContain("Record approaches you've already attempted");
    expect(src).toContain("Note strategies or channels to steer clear of");
    expect(src).toContain("Capture your current best guess at the right approach");
    expect(src).toContain("Add feedback and review comments from stakeholders");
    expect(src).toContain("Document decisions that are locked in");
    expect(src).toContain("Track unresolved questions that need answers");
  });
});

// ---------------------------------------------------------------------------
// Phase 2: useObjectiveMemories hook
// ---------------------------------------------------------------------------
describe("useObjectiveMemories hook", () => {
  const filePath = "features/objectives/hooks/useObjectiveMemories.ts";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("imports SidecarClient and MemoryRecord", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SidecarClient");
    expect(src).toContain("MemoryRecord");
  });

  it("calls listMemories with objectiveId and scope objective", () => {
    const src = readSrc(filePath);
    expect(src).toContain("listMemories");
    expect(src).toContain("objectiveId");
    expect(src).toContain('scope: "objective"');
  });

  it("exports useObjectiveMemories function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function useObjectiveMemories/);
  });

  it("returns groupedEntries, isLoading, isEmpty, and refresh", () => {
    const src = readSrc(filePath);
    expect(src).toContain("groupedEntries");
    expect(src).toContain("isLoading");
    expect(src).toContain("isEmpty");
    expect(src).toContain("refresh");
  });

  it("groups entries by all 8 objective memory categories", () => {
    const src = readSrc(filePath);
    expect(src).toContain("OBJECTIVE_MEMORY_CATEGORIES");
  });

  it("uses cancellation flag pattern", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/cancelled|canceled/);
  });
});

// ---------------------------------------------------------------------------
// Phase 3: ObjectiveMemoryTab component
// ---------------------------------------------------------------------------
describe("ObjectiveMemoryTab component", () => {
  const filePath = "features/objectives/components/ObjectiveMemoryTab.tsx";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("accepts agentId, objectiveId, and client props", () => {
    const src = readSrc(filePath);
    expect(src).toContain("agentId");
    expect(src).toContain("objectiveId");
    expect(src).toContain("client");
  });

  it("uses useObjectiveMemories hook", () => {
    const src = readSrc(filePath);
    expect(src).toContain("useObjectiveMemories");
  });

  it("renders MemoryCategoryGroup for each category", () => {
    const src = readSrc(filePath);
    expect(src).toContain("MemoryCategoryGroup");
  });

  it("manages CRUD state: editingId, creatingCategory, deletingId", () => {
    const src = readSrc(filePath);
    expect(src).toContain("editingId");
    expect(src).toContain("creatingCategory");
    expect(src).toContain("deletingId");
  });

  it("handles create with conflict detection", () => {
    const src = readSrc(filePath);
    expect(src).toContain("conflictState");
    expect(src).toContain("MemoryConflictDialog");
  });

  it("handles delete with confirmation dialog", () => {
    const src = readSrc(filePath);
    expect(src).toContain("Delete memory entry");
    expect(src).toContain("DialogContent");
  });

  it("passes category-specific empty prompts from OBJECTIVE_CATEGORY_EMPTY_PROMPTS", () => {
    const src = readSrc(filePath);
    expect(src).toContain("OBJECTIVE_CATEGORY_EMPTY_PROMPTS");
  });

  it("creates memory entries with scope objective and objectiveId", () => {
    const src = readSrc(filePath);
    expect(src).toContain('scope: "objective"');
    expect(src).toContain("objectiveId");
    expect(src).toContain("createMemory");
  });

  it("shows loading skeleton state", () => {
    const src = readSrc(filePath);
    expect(src).toContain("isLoading");
    expect(src).toMatch(/animate-pulse|Skeleton/);
  });

  it("shows empty state per category with guidance prompts", () => {
    const src = readSrc(filePath);
    expect(src).toContain("emptyMessage");
  });
});

// ---------------------------------------------------------------------------
// Phase 4: ObjectiveTabNav wiring
// ---------------------------------------------------------------------------
describe("ObjectiveTabNav — Memory tab wired", () => {
  it("imports ObjectiveMemoryTab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain("ObjectiveMemoryTab");
  });

  it("renders ObjectiveMemoryTab instead of PlaceholderTab for memory", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    // The memory tab content should use ObjectiveMemoryTab
    const memoryTabStart = src.indexOf('value="memory"');
    expect(memoryTabStart).toBeGreaterThan(-1);
    // Find the closing </TabsContent> after the memory tab
    const memoryTabEnd = src.indexOf("</TabsContent>", memoryTabStart);
    const memorySection = src.slice(memoryTabStart, memoryTabEnd);
    expect(memorySection).toContain("ObjectiveMemoryTab");
    expect(memorySection).not.toContain("PlaceholderTab");
  });
});
