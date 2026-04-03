import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const componentPath = resolve(
  __dirname,
  "../../apps/desktop/src/features/dashboard/components/DashboardWorkspace.tsx",
);

const readComponent = () => readFileSync(componentPath, "utf-8");

// ═══════════════════════════════════════════════════════
// 1. handleOutputNavigate parses contentRef as fallback
// ═══════════════════════════════════════════════════════

describe("handleOutputNavigate uses contentRef fallback", () => {
  it("references artifact.contentRef in the handler", () => {
    const src = readComponent();
    const handler = src.slice(
      src.indexOf("function handleOutputNavigate"),
      src.indexOf("function handleOutputNavigate") + 800,
    );
    expect(handler).toContain("artifact.contentRef");
  });

  it("parses session ID from contentRef format 'session:{id}/message:{id}'", () => {
    const src = readComponent();
    const handler = src.slice(
      src.indexOf("function handleOutputNavigate"),
      src.indexOf("function handleOutputNavigate") + 800,
    );
    // Should contain a regex or string operation to extract session ID from contentRef
    expect(handler).toMatch(/session:/);
  });

  it("calls onResumeRun with the parsed session ID from contentRef", () => {
    const src = readComponent();
    const handler = src.slice(
      src.indexOf("function handleOutputNavigate"),
      src.indexOf("function handleOutputNavigate") + 800,
    );
    // After parsing contentRef, it should call onResumeRun
    // Count occurrences of onResumeRun — should appear at least twice
    // (once for runId path, once for contentRef path)
    const matches = handler.match(/onResumeRun\??\.\(/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════
// 2. runId lookup still takes priority
// ═══════════════════════════════════════════════════════

describe("runId lookup still takes priority over contentRef", () => {
  it("checks artifact.runId before artifact.contentRef", () => {
    const src = readComponent();
    const handler = src.slice(
      src.indexOf("function handleOutputNavigate"),
      src.indexOf("function handleOutputNavigate") + 800,
    );
    const runIdPos = handler.indexOf("artifact.runId");
    const contentRefPos = handler.indexOf("artifact.contentRef");
    expect(runIdPos).toBeGreaterThan(-1);
    expect(contentRefPos).toBeGreaterThan(-1);
    expect(runIdPos).toBeLessThan(contentRefPos);
  });
});

// ═══════════════════════════════════════════════════════
// 3. Specialist fallback still exists when both lookups fail
// ═══════════════════════════════════════════════════════

describe("Specialist fallback still exists", () => {
  it("still has specialist fallback using artifact.createdBy", () => {
    const src = readComponent();
    const handler = src.slice(
      src.indexOf("function handleOutputNavigate"),
      src.indexOf("function handleOutputNavigate") + 800,
    );
    expect(handler).toContain("artifact.createdBy");
    expect(handler).toContain("specialist=");
  });

  it("specialist fallback comes after contentRef check", () => {
    const src = readComponent();
    const handler = src.slice(
      src.indexOf("function handleOutputNavigate"),
      src.indexOf("function handleOutputNavigate") + 800,
    );
    const contentRefPos = handler.indexOf("artifact.contentRef");
    const specialistPos = handler.indexOf("specialist=");
    expect(contentRefPos).toBeGreaterThan(-1);
    expect(specialistPos).toBeGreaterThan(-1);
    expect(contentRefPos).toBeLessThan(specialistPos);
  });
});

// ═══════════════════════════════════════════════════════
// 4. parseSessionFromContentRef helper
// ═══════════════════════════════════════════════════════

describe("parseSessionFromContentRef helper", () => {
  it("exports or defines a helper to parse session ID from contentRef", () => {
    const src = readComponent();
    expect(src).toMatch(/parseSessionFromContentRef/);
  });
});
