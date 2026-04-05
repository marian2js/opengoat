import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../apps/desktop/src/features/brain/components/BrainWorkspace.tsx"),
  "utf-8",
);

describe("Brain section card backgrounds — visual separation", () => {
  // AC1: A dedicated component wraps markdown h2 sections in card containers
  it("has a SectionedMarkdownView component", () => {
    expect(src).toContain("function SectionedMarkdownView");
  });

  it("BrainEditor uses SectionedMarkdownView for markdown sections", () => {
    expect(src).toContain("<SectionedMarkdownView");
  });

  // AC2: Each section card has subtle background, border, and rounded corners
  it("section cards use a theme-aware background", () => {
    const fnStart = src.indexOf("function SectionedMarkdownView");
    expect(fnStart).toBeGreaterThan(0);
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(fnBody).toMatch(/bg-card|bg-muted\/\d/);
  });

  it("section cards have rounded corners", () => {
    const fnStart = src.indexOf("function SectionedMarkdownView");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(fnBody).toContain("rounded-lg");
  });

  it("section cards have a border", () => {
    const fnStart = src.indexOf("function SectionedMarkdownView");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(fnBody).toContain("border");
  });

  it("section cards have internal padding", () => {
    const fnStart = src.indexOf("function SectionedMarkdownView");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(fnBody).toMatch(/p-[45]|px-[45]/);
  });

  // AC3: Consistent spacing between section cards (12-16px gap)
  it("section cards container has vertical spacing", () => {
    const fnStart = src.indexOf("function SectionedMarkdownView");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    // space-y-3 = 12px, space-y-4 = 16px, gap-3 = 12px, gap-4 = 16px
    expect(fnBody).toMatch(/space-y-[34]|gap-[34]/);
  });

  // AC4: Markdown is split by h2 headings
  it("splits content by h2 headings", () => {
    const fnStart = src.indexOf("function SectionedMarkdownView");
    const fnEnd = src.indexOf("\nfunction ", fnStart + 1);
    const fnBody = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    // Should split by h2 pattern
    expect(fnBody).toMatch(/##\s/);
  });
});
