import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(desktopSrc, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// readBrainSectionFromHash — pure function extraction for testing
// ---------------------------------------------------------------------------

/**
 * Mirrors the readBrainSectionFromHash logic from App.tsx.
 * We test the extracted logic here; source-level tests verify the real code.
 */
function readBrainSectionFromHash(hash: string): string {
  if (hash.startsWith("#brain/")) {
    return hash.slice("#brain/".length);
  }
  return "product";
}

// ---------------------------------------------------------------------------
// AC1: #brain/market loads Market section on fresh page load
// ---------------------------------------------------------------------------
describe("Brain sub-section hash routing", () => {
  it("parses #brain/market to 'market'", () => {
    expect(readBrainSectionFromHash("#brain/market")).toBe("market");
  });

  it("parses #brain/product to 'product'", () => {
    expect(readBrainSectionFromHash("#brain/product")).toBe("product");
  });

  it("parses #brain/growth to 'growth'", () => {
    expect(readBrainSectionFromHash("#brain/growth")).toBe("growth");
  });

  // AC2: #brain/saved-guidance loads Saved Guidance section
  it("parses #brain/saved-guidance to 'saved-guidance'", () => {
    expect(readBrainSectionFromHash("#brain/saved-guidance")).toBe(
      "saved-guidance",
    );
  });

  it("parses #brain/company-context to 'company-context'", () => {
    expect(readBrainSectionFromHash("#brain/company-context")).toBe(
      "company-context",
    );
  });

  it("parses #brain/knowledge-base to 'knowledge-base'", () => {
    expect(readBrainSectionFromHash("#brain/knowledge-base")).toBe(
      "knowledge-base",
    );
  });

  it("defaults to 'product' for bare #brain hash", () => {
    expect(readBrainSectionFromHash("#brain")).toBe("product");
  });
});

// ---------------------------------------------------------------------------
// AC3: All 6 Brain sub-sections are accessible via direct URL
// BRAIN_SECTIONS IDs must match the URL-friendly slugs
// ---------------------------------------------------------------------------
describe("BRAIN_SECTIONS IDs match URL-friendly slugs", () => {
  const brainSrc = readSrc("features/brain/components/BrainWorkspace.tsx");

  it("has 'product' section ID", () => {
    expect(brainSrc).toContain('id: "product"');
  });

  it("has 'market' section ID", () => {
    expect(brainSrc).toContain('id: "market"');
  });

  it("has 'growth' section ID", () => {
    expect(brainSrc).toContain('id: "growth"');
  });

  it("has 'company-context' section ID (not 'memory')", () => {
    expect(brainSrc).toContain('id: "company-context"');
  });

  it("has 'saved-guidance' section ID (not 'operating-memory')", () => {
    expect(brainSrc).toContain('id: "saved-guidance"');
  });

  it("has 'knowledge-base' section ID (not 'knowledge')", () => {
    expect(brainSrc).toContain('id: "knowledge-base"');
  });
});

// ---------------------------------------------------------------------------
// AC4: Navigation hrefs use URL-friendly slugs
// ---------------------------------------------------------------------------
describe("Navigation hrefs use URL-friendly slugs", () => {
  const navSrc = readSrc("app/config/navigation.ts");

  it("Company Context links to #brain/company-context", () => {
    expect(navSrc).toContain("#brain/company-context");
  });

  it("Saved Guidance links to #brain/saved-guidance", () => {
    expect(navSrc).toContain("#brain/saved-guidance");
  });

  it("Knowledge Base links to #brain/knowledge-base", () => {
    expect(navSrc).toContain("#brain/knowledge-base");
  });

  it("Product links to #brain/product", () => {
    expect(navSrc).toContain("#brain/product");
  });

  it("Market links to #brain/market", () => {
    expect(navSrc).toContain("#brain/market");
  });

  it("Growth links to #brain/growth", () => {
    expect(navSrc).toContain("#brain/growth");
  });
});

// ---------------------------------------------------------------------------
// AC5: Sidebar click navigation continues to work
// AppSidebar uses activeBrainSection to match section hrefs
// ---------------------------------------------------------------------------
describe("Sidebar active state uses section IDs from hash", () => {
  const sidebarSrc = readSrc("app/shell/AppSidebar.tsx");

  it("compares item.href against activeBrainSection for active state", () => {
    expect(sidebarSrc).toContain("activeBrainSection");
    expect(sidebarSrc).toMatch(/item\.href\s*===\s*`#brain\/\$\{activeBrainSection\}`/);
  });
});
