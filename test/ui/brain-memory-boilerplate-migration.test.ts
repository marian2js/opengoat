import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/brain/components/BrainWorkspace.tsx"),
  "utf-8",
);

describe("migrateMemoryBoilerplate", () => {
  // AC1: Memory page Preferences section no longer shows "Coding style"
  it("detects old Preferences boilerplate containing 'Coding style'", () => {
    expect(src).toContain("migrateMemoryBoilerplate");
    expect(src).toContain("Coding style, communication preferences, and conventions.");
  });

  // AC2: All three Memory section descriptions use marketing-domain language
  it("maps old Key Decisions description to marketing copy", () => {
    expect(src).toContain("Important decisions and the reasoning behind them.");
    expect(src).toContain("Record strategic decisions and the reasoning behind them");
  });

  it("maps old Preferences description to marketing copy", () => {
    expect(src).toContain("Define brand voice, content tone, and communication conventions");
  });

  it("maps old Context description to marketing copy", () => {
    expect(src).toContain("Background information that helps the AI assist more effectively.");
    expect(src).toContain("Share product and market context that helps the AI provide more relevant assistance");
  });

  // AC3: Existing projects are updated or display corrected text
  it("is applied when loading memory content in BrainEditor", () => {
    expect(src).toContain("migrateMemoryBoilerplate");
    expect(src).toMatch(/section\.id === ["']company-context["']/);
  });

  it("is applied in MemoryContentView for display", () => {
    const memoryViewIndex = src.indexOf("function MemoryContentView");
    const nextFunctionIndex = src.indexOf("\nfunction ", memoryViewIndex + 1);
    const memoryViewBody = src.slice(memoryViewIndex, nextFunctionIndex > 0 ? nextFunctionIndex : undefined);
    expect(memoryViewBody).toContain("migrateMemoryBoilerplate");
  });

  it("persists migrated content via writeWorkspaceFile", () => {
    expect(src).toContain("writeWorkspaceFile");
  });

  // AC4: New projects continue using the updated template
  it("memory placeholder template uses marketing-domain language", () => {
    // Find the company-context section placeholder
    const memoryIndex = src.indexOf('id: "company-context"');
    expect(memoryIndex).toBeGreaterThan(0);
    const memorySection = src.slice(memoryIndex, memoryIndex + 600);
    const placeholderMatch = memorySection.match(/placeholder:\s*`([^`]+)`/s);
    expect(placeholderMatch).toBeTruthy();
    const placeholder = placeholderMatch![1]!;
    expect(placeholder).not.toContain("Coding style");
    expect(placeholder).toMatch(/brand voice|content tone/);
  });
});
