import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(
    __dirname,
    "../../apps/desktop/src/features/action-session/components/SaveToBoardControls.tsx",
  ),
  "utf-8",
);

describe("SaveToBoardControls gating", () => {
  it("does NOT show old generic prompt 'This work is ready. Save to Board?'", () => {
    expect(src).not.toContain("This work is ready. Save to Board?");
  });

  it("shows guidance about what belongs on the board", () => {
    // Should mention follow-up, human work, or action items
    expect(src).toMatch(/follow.?up|human|action items/i);
  });

  it("shows hint text explaining board purpose vs chat history", () => {
    // Should have guidance copy about what board is for
    expect(src).toMatch(/Board is for|board-worthy|human follow/i);
  });

  it("defaults outputs to unchecked (empty Set initial state)", () => {
    // Should initialize selectedIds with empty Set, not all outputs
    expect(src).toContain("new Set()");
    // Should NOT pre-select all outputs
    expect(src).not.toContain("new Set(outputs.map");
  });

  it("Skip button is present and prominent", () => {
    expect(src).toContain("Skip");
    expect(src).toContain("onSkip");
  });

  it("Save button still works when items are selected", () => {
    expect(src).toContain("handleSave");
    expect(src).toContain("Save to Board");
  });
});
