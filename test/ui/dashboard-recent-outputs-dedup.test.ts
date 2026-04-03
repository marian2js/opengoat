import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const hookPath = resolve(
  __dirname,
  "../../apps/desktop/src/features/dashboard/hooks/useRecentArtifacts.ts",
);

const readHook = () => readFileSync(hookPath, "utf-8");

// ═══════════════════════════════════════════════════════
// 1. MAX_VISIBLE reduced from 8 to 4
// ═══════════════════════════════════════════════════════

describe("MAX_VISIBLE is 4", () => {
  it("sets MAX_VISIBLE to 4", () => {
    const src = readHook();
    expect(src).toContain("const MAX_VISIBLE = 4;");
  });

  it("does not use the old MAX_VISIBLE of 8", () => {
    const src = readHook();
    expect(src).not.toContain("const MAX_VISIBLE = 8;");
  });
});

// ═══════════════════════════════════════════════════════
// 2. Deduplication by type + createdBy
// ═══════════════════════════════════════════════════════

describe("Deduplication logic in processArtifacts", () => {
  it("deduplicates standalone artifacts by type + createdBy", () => {
    const src = readHook();
    // Must build a dedup key from type and createdBy
    expect(src).toContain("artifact.type");
    expect(src).toContain("artifact.createdBy");
    // Should use a Map for dedup
    expect(src).toMatch(/new Map/);
    // Should reference deduped standalone in entries
    expect(src).toContain("dedupedStandalone");
  });

  it("uses dedupedStandalone (not standaloneList) in entry building", () => {
    const src = readHook();
    // The entries array should use dedupedStandalone for standalone items
    const entriesSection = src.slice(src.indexOf("const entries"));
    expect(entriesSection).toContain("dedupedStandalone");
    // standaloneList should NOT appear in the entries mapping after dedup
    expect(entriesSection).not.toContain("standaloneList.map");
  });
});

// ═══════════════════════════════════════════════════════
// 3. Agents page outputs are unaffected
// ═══════════════════════════════════════════════════════

describe("Agents page specialist outputs are unaffected", () => {
  it("deduplication only applies inside processArtifacts (dashboard), not in the hook level", () => {
    const src = readHook();
    // processArtifacts is the only place where dedup happens; the hook itself
    // returns whatever processArtifacts gives it, so agents page (which uses
    // a different hook or fetches directly) is unaffected.
    // Verify dedup variable exists only after the processArtifacts function starts
    const processStart = src.indexOf("function processArtifacts");
    const dedupPos = src.indexOf("dedupedStandalone");
    expect(processStart).toBeGreaterThan(-1);
    expect(dedupPos).toBeGreaterThan(-1);
    expect(dedupPos).toBeGreaterThan(processStart);

    // Verify dedup does NOT appear in the hook function (useRecentArtifacts)
    const hookBody = src.slice(
      src.indexOf("function useRecentArtifacts"),
      processStart,
    );
    expect(hookBody).not.toContain("dedupedStandalone");
  });
});
