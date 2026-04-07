import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

const COMPONENT_PATH = "features/dashboard/components/RecentOutputs.tsx";
const DASHBOARD_PATH = "features/dashboard/components/DashboardWorkspace.tsx";

// ═══════════════════════════════════════════════════════
// RecentOutputs — structure validation
// ═══════════════════════════════════════════════════════

describe("RecentOutputs structure", () => {
  it("exports a named function", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("export function RecentOutputs");
  });

  it("accepts onSpecialistChat prop", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("onSpecialistChat");
  });
});

// ═══════════════════════════════════════════════════════
// RecentOutputs — proof-of-value empty state
// ═══════════════════════════════════════════════════════

describe("RecentOutputs proof-of-value empty state", () => {
  it("defines EXAMPLE_OUTPUTS constant", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("EXAMPLE_OUTPUTS");
  });

  it("includes all 6 human-readable example output names matching spec §9.3", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("Hero Rewrite Bundle");
    expect(src).toContain("Competitor Messaging Matrix");
    expect(src).toContain("SEO Opportunity Map");
    expect(src).toContain("Product Hunt Launch Pack");
    expect(src).toContain("Launch Surface Shortlist");
    expect(src).toContain("Comparison Page Backlog");
  });

  it("imports getArtifactTypeConfig for type badge colors", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("getArtifactTypeConfig");
  });

  it("imports getSpecialistMeta for specialist attribution", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("getSpecialistMeta");
  });

  it("imports getSpecialistColors for specialist color tokens", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("getSpecialistColors");
  });

  it("uses grid-cols-2 for 2-column gallery layout", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("grid-cols-2");
  });

  it("includes a Start CTA in the empty state", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toMatch(/Start/);
  });

  it("shows 'Your team can produce' heading", () => {
    const src = readFile(COMPONENT_PATH);
    expect(src).toContain("Your team can produce");
  });

  it("includes an 'EXAMPLE' visual distinction badge on each card", () => {
    const src = readFile(COMPONENT_PATH);
    // Each example card should have a visible "EXAMPLE" label to distinguish from real outputs
    expect(src).toMatch(/EXAMPLE/);
    // Badge should use monospace styling consistent with design system
    expect(src).toMatch(/font-mono.*EXAMPLE|EXAMPLE.*font-mono/s);
  });
});

// ═══════════════════════════════════════════════════════
// DashboardWorkspace — prop threading
// ═══════════════════════════════════════════════════════

describe("DashboardWorkspace passes onSpecialistChat to RecentOutputs", () => {
  it("threads handleSpecialistChat as onSpecialistChat prop", () => {
    const src = readFile(DASHBOARD_PATH);
    expect(src).toContain("onSpecialistChat={handleSpecialistChat}");
  });
});
