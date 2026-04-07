import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const dashDir = resolve(
  __dirname,
  "../../apps/desktop/src/features/dashboard",
);
const readSrc = (path: string) =>
  readFileSync(resolve(dashDir, path), "utf-8");

// ═══════════════════════════════════════════════════════
// 1. JobOrientedInput component
// ═══════════════════════════════════════════════════════

describe("JobOrientedInput component", () => {
  const componentPath = resolve(dashDir, "components/JobOrientedInput.tsx");

  it("component file exists", () => {
    expect(existsSync(componentPath)).toBe(true);
  });

  it("exports JobOrientedInput", () => {
    const src = readSrc("components/JobOrientedInput.tsx");
    expect(src).toContain("export function JobOrientedInput");
  });

  it("uses job-oriented placeholder framing", () => {
    const src = readSrc("components/JobOrientedInput.tsx");
    // Must contain job-oriented language, not CMO branding
    expect(src).toMatch(/get.*done|want to produce|marketing job/i);
  });

  it("does NOT use CMO branding", () => {
    const src = readSrc("components/JobOrientedInput.tsx");
    expect(src).not.toContain("Ask CMO");
    expect(src).not.toContain("BrainIcon");
    expect(src).not.toContain('"CMO"');
  });

  it("has a textarea for multi-line input", () => {
    const src = readSrc("components/JobOrientedInput.tsx");
    expect(src).toContain("<textarea");
  });

  it("handles Enter key for submission", () => {
    const src = readSrc("components/JobOrientedInput.tsx");
    expect(src).toContain("Enter");
    expect(src).toContain("handleSubmit");
  });

  it("has a submit button with ArrowRight icon", () => {
    const src = readSrc("components/JobOrientedInput.tsx");
    expect(src).toContain("ArrowRightIcon");
    expect(src).toContain("<button");
  });

  it("accepts onSubmit prop", () => {
    const src = readSrc("components/JobOrientedInput.tsx");
    expect(src).toContain("onSubmit");
  });

  it("has a job-oriented section label", () => {
    const src = readSrc("components/JobOrientedInput.tsx");
    // Should have a section label like "YOUR NEXT MOVE" or similar
    expect(src).toContain("section-label");
  });
});

// ═══════════════════════════════════════════════════════
// 2. DashboardWorkspace integration
// ═══════════════════════════════════════════════════════

describe("DashboardWorkspace integrates JobOrientedInput", () => {
  it("imports JobOrientedInput", () => {
    const src = readSrc("components/DashboardWorkspace.tsx");
    expect(src).toContain("JobOrientedInput");
  });

  it("renders JobOrientedInput after RecommendedJobs", () => {
    const src = readSrc("components/DashboardWorkspace.tsx");
    const jobsIdx = src.indexOf("RecommendedJobs");
    const inputIdx = src.indexOf("JobOrientedInput", jobsIdx);
    const rosterIdx = src.indexOf("DashboardAgentRoster", inputIdx);
    // JobOrientedInput appears between RecommendedJobs and DashboardAgentRoster
    expect(inputIdx).toBeGreaterThan(jobsIdx);
    expect(rosterIdx).toBeGreaterThan(inputIdx);
  });

  it("passes handleFreeTextSubmit to JobOrientedInput", () => {
    const src = readSrc("components/DashboardWorkspace.tsx");
    expect(src).toMatch(/JobOrientedInput[\s\S]*?handleFreeTextSubmit/);
  });
});
