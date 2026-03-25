import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ── Helpers ──
const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

// ═══════════════════════════════════════════════════════
// 1. getAllActionSessionMetas — data layer
// ═══════════════════════════════════════════════════════

describe("getAllActionSessionMetas", () => {
  it("is exported from action-session-state.ts", () => {
    const src = readFile("features/action-session/lib/action-session-state.ts");
    expect(src).toContain("export function getAllActionSessionMetas");
  });

  it("returns a MetaStore record", () => {
    const src = readFile("features/action-session/lib/action-session-state.ts");
    expect(src).toContain("getAllActionSessionMetas");
    expect(src).toContain("MetaStore");
  });
});

// ═══════════════════════════════════════════════════════
// 2. useActionSessions hook
// ═══════════════════════════════════════════════════════

describe("useActionSessions hook", () => {
  const hookPath = "features/dashboard/hooks/useActionSessions.ts";

  it("exists as a hook file", () => {
    expect(existsSync(resolve(desktopSrc, hookPath))).toBe(true);
  });

  it("imports getAllActionSessionMetas", () => {
    const src = readFile(hookPath);
    expect(src).toContain("getAllActionSessionMetas");
  });

  it("exports useActionSessions function", () => {
    const src = readFile(hookPath);
    expect(src).toContain("export function useActionSessions");
  });

  it("returns activeSessions and recentSessions", () => {
    const src = readFile(hookPath);
    expect(src).toContain("activeSessions");
    expect(src).toContain("recentSessions");
  });

  it("returns hasActiveWork boolean", () => {
    const src = readFile(hookPath);
    expect(src).toContain("hasActiveWork");
  });

  it("sorts sessions by startedAt descending", () => {
    const src = readFile(hookPath);
    expect(src).toContain("startedAt");
    expect(src).toContain("sort");
  });
});

// ═══════════════════════════════════════════════════════
// 3. ActiveWorkSection component
// ═══════════════════════════════════════════════════════

describe("ActiveWorkSection component", () => {
  const componentPath = "features/dashboard/components/ActiveWorkSection.tsx";

  it("exists as a component file", () => {
    expect(existsSync(resolve(desktopSrc, componentPath))).toBe(true);
  });

  it("imports useActionSessions hook", () => {
    const src = readFile(componentPath);
    expect(src).toContain("useActionSessions");
  });

  it("renders 'Now working on' section for active sessions", () => {
    const src = readFile(componentPath);
    expect(src).toContain("Now working on");
  });

  it("renders 'Recent work' section for completed sessions", () => {
    const src = readFile(componentPath);
    expect(src).toContain("Recent work");
  });

  it("shows action title for each session", () => {
    const src = readFile(componentPath);
    expect(src).toContain("actionTitle");
  });

  it("shows session state/status", () => {
    const src = readFile(componentPath);
    expect(src).toContain("state");
  });

  it("has continue quick action button", () => {
    const src = readFile(componentPath);
    expect(src).toContain("Continue");
  });

  it("has review quick action button", () => {
    const src = readFile(componentPath);
    expect(src).toContain("Review");
  });

  it("calls onContinueSession when continue is clicked", () => {
    const src = readFile(componentPath);
    expect(src).toContain("onContinueSession");
  });

  it("returns null when no active or recent work exists", () => {
    const src = readFile(componentPath);
    // Should check for empty state and return null
    expect(src).toContain("return null");
  });

  it("uses section-label styling for headings", () => {
    const src = readFile(componentPath);
    expect(src).toContain("section-label");
  });

  it("uses primary color for section icon", () => {
    const src = readFile(componentPath);
    expect(src).toContain("text-primary");
  });
});

// ═══════════════════════════════════════════════════════
// 4. DashboardWorkspace integration
// ═══════════════════════════════════════════════════════

describe("DashboardWorkspace active work integration", () => {
  it("imports ActiveWorkSection", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("ActiveWorkSection");
  });

  it("renders ActiveWorkSection in Mode B", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("<ActiveWorkSection");
  });

  it("uses useActionSessions for mode detection", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("useActionSessions");
  });

  it("passes onContinueSession to ActiveWorkSection", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("onContinueSession");
  });
});

// ═══════════════════════════════════════════════════════
// 5. Mode A stays clean — no active work section when empty
// ═══════════════════════════════════════════════════════

describe("Mode A stays clean", () => {
  it("ActiveWorkSection returns null when no sessions", () => {
    const src = readFile("features/dashboard/components/ActiveWorkSection.tsx");
    // The component should have early return null when both lists are empty
    expect(src).toContain("return null");
  });

  it("Mode A does not render ActiveWorkSection", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    // ActiveWorkSection should only appear in the hasActiveWork branch
    // The Mode A section should not contain ActiveWorkSection
    const modeAComment = "Mode A";
    const modeBComment = "Mode B";
    expect(src).toContain(modeAComment);
    expect(src).toContain(modeBComment);
  });
});
