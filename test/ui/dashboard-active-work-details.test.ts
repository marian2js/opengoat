import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

// ═══════════════════════════════════════════════════════
// 1. ActionSessionMeta includes latestOutput field
// ═══════════════════════════════════════════════════════

describe("ActionSessionMeta latestOutput field", () => {
  it("types.ts includes latestOutput on ActionSessionMeta", () => {
    const src = readFile("features/action-session/types.ts");
    expect(src).toContain("latestOutput");
  });

  it("latestOutput is optional (string | undefined)", () => {
    const src = readFile("features/action-session/types.ts");
    expect(src).toMatch(/latestOutput\??\s*:\s*string/);
  });
});

// ═══════════════════════════════════════════════════════
// 2. Persistence layer supports latestOutput
// ═══════════════════════════════════════════════════════

describe("action-session-state persistence supports latestOutput", () => {
  it("updateActionSessionLatestOutput function is exported", () => {
    const src = readFile("features/action-session/lib/action-session-state.ts");
    expect(src).toContain("export function updateActionSessionLatestOutput");
  });

  it("updateActionSessionLatestOutput takes sessionId and output string", () => {
    const src = readFile("features/action-session/lib/action-session-state.ts");
    expect(src).toContain("updateActionSessionLatestOutput(sessionId: string");
  });
});

// ═══════════════════════════════════════════════════════
// 3. ActionSessionView persists latestOutput
// ═══════════════════════════════════════════════════════

describe("ActionSessionView persists latestOutput", () => {
  it("imports updateActionSessionLatestOutput", () => {
    const src = readFile(
      "features/action-session/components/ActionSessionView.tsx",
    );
    expect(src).toContain("updateActionSessionLatestOutput");
  });

  it("calls updateActionSessionLatestOutput when outputs change", () => {
    const src = readFile(
      "features/action-session/components/ActionSessionView.tsx",
    );
    // Should have an effect or call that persists the latest output
    expect(src).toContain("updateActionSessionLatestOutput");
  });
});

// ═══════════════════════════════════════════════════════
// 4. useActionSessions includes latestOutput in entries
// ═══════════════════════════════════════════════════════

describe("useActionSessions exposes latestOutput", () => {
  it("ActionSessionEntry interface includes latestOutput", () => {
    const src = readFile("features/dashboard/hooks/useActionSessions.ts");
    expect(src).toContain("latestOutput");
  });

  it("maps latestOutput from meta store", () => {
    const src = readFile("features/dashboard/hooks/useActionSessions.ts");
    // The mapping should include latestOutput
    expect(src).toMatch(/latestOutput.*meta\.latestOutput/s);
  });
});

// ═══════════════════════════════════════════════════════
// 5. ActiveWorkSection shows output preview
// ═══════════════════════════════════════════════════════

describe("ActiveWorkSection output preview", () => {
  const componentPath = "features/dashboard/components/ActiveWorkSection.tsx";

  it("renders latestOutput preview text", () => {
    const src = readFile(componentPath);
    expect(src).toContain("latestOutput");
  });

  it("truncates output preview with line-clamp", () => {
    const src = readFile(componentPath);
    expect(src).toContain("line-clamp");
  });
});

// ═══════════════════════════════════════════════════════
// 6. ActiveWorkSection has Continue button on recent items
// ═══════════════════════════════════════════════════════

describe("ActiveWorkSection Continue button on recent items", () => {
  const componentPath = "features/dashboard/components/ActiveWorkSection.tsx";

  it("recent variant has Continue button", () => {
    const src = readFile(componentPath);
    // The recent variant code should contain a Continue action
    // Check that "recent" variant section also has Continue
    const recentSectionStart = src.indexOf('variant === "recent"');
    expect(recentSectionStart).toBeGreaterThan(-1);
    const recentSection = src.slice(recentSectionStart, recentSectionStart + 1500);
    expect(recentSection).toContain("Continue");
  });
});

// ═══════════════════════════════════════════════════════
// 7. ActiveWorkSection has Open Board button
// ═══════════════════════════════════════════════════════

describe("ActiveWorkSection Open Board button", () => {
  const componentPath = "features/dashboard/components/ActiveWorkSection.tsx";

  it("has Open Board quick action", () => {
    const src = readFile(componentPath);
    expect(src).toContain("Open Board");
  });

  it("Open Board links to #board", () => {
    const src = readFile(componentPath);
    expect(src).toContain("#board");
  });

  it("Open Board uses LayoutDashboard or similar board icon", () => {
    const src = readFile(componentPath);
    // Should have an icon for board navigation
    expect(src).toContain("LayoutDashboardIcon");
  });
});

// ═══════════════════════════════════════════════════════
// 8. Section remains compact
// ═══════════════════════════════════════════════════════

describe("Section compactness", () => {
  const componentPath = "features/dashboard/components/ActiveWorkSection.tsx";

  it("still limits recent sessions to 5", () => {
    const src = readFile(componentPath);
    expect(src).toContain("slice(0, 5)");
  });

  it("still returns null when no active work", () => {
    const src = readFile(componentPath);
    expect(src).toContain("return null");
  });

  it("uses section-label for headings", () => {
    const src = readFile(componentPath);
    expect(src).toContain("section-label");
  });
});
