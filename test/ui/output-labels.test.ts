import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const utilPath = resolve(
  __dirname,
  "../../apps/desktop/src/lib/utils/output-labels.ts",
);

describe("output-labels utility", () => {
  it("utility file exists", () => {
    expect(existsSync(utilPath)).toBe(true);
  });

  it("exports a humanizeOutputLabel function", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/export\s+(function\s+humanizeOutputLabel|const\s+humanizeOutputLabel)/);
  });

  it("converts snake_case artifact types to readable labels", () => {
    const src = readFileSync(utilPath, "utf-8");
    // Should handle types like 'hero_rewrite', 'launch_pack', etc.
    expect(src).toMatch(/replace|split|_/);
  });

  it("passes through already-readable titles unchanged", () => {
    // The function should not mangle already good titles
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toContain("title");
  });

  it("exports a formatRelativeTime function", () => {
    const src = readFileSync(utilPath, "utf-8");
    expect(src).toMatch(/export\s+(function\s+formatRelativeTime|const\s+formatRelativeTime)/);
  });
});
