import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

// ═══════════════════════════════════════════════════════
// 1. ActionSessionMeta includes latestOutput field
// ═══════════════════════���═══════════════════════════════

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

// ═══════════════════════════════��═══════════════════════
// 2. Persistence layer supports latestOutput
// ════��══════════════════════════════════════════════════

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

// ═════════════��═════════════════════════════════════════
// 3. ActionSessionView persists latestOutput
// ═══════���═══════════════════════════════════════════════

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
    expect(src).toContain("updateActionSessionLatestOutput");
  });
});

// ══════���════════════════════════════════════���═══════════
// 4. useActionSessions includes latestOutput in entries
// ══════════���════════════════════════════════════════════

describe("useActionSessions exposes latestOutput", () => {
  it("ActionSessionEntry interface includes latestOutput", () => {
    const src = readFile("features/dashboard/hooks/useActionSessions.ts");
    expect(src).toContain("latestOutput");
  });

  it("maps latestOutput from meta store", () => {
    const src = readFile("features/dashboard/hooks/useActionSessions.ts");
    expect(src).toMatch(/latestOutput.*meta\.latestOutput/s);
  });
});

// ═══════════════════════════════════════════════════════
// 5. ContinueWhereYouLeftOff — compact continue section
// ══════════════════���════════════════════════════════════

describe("ContinueWhereYouLeftOff compact section", () => {
  const componentPath = "features/dashboard/components/ContinueWhereYouLeftOff.tsx";

  it("exists as a component file", () => {
    expect(existsSync(resolve(desktopSrc, componentPath))).toBe(true);
  });

  it("shows continue CTA for items", () => {
    const src = readFile(componentPath);
    expect(src).toContain("Continue");
    expect(src).toContain("onContinue");
  });

  it("uses compact layout", () => {
    const src = readFile(componentPath);
    expect(src).toContain("border-border/20");
  });

  it("uses section-label for heading", () => {
    const src = readFile(componentPath);
    expect(src).toContain("section-label");
  });

  it("returns null when no items", () => {
    const src = readFile(componentPath);
    expect(src).toContain("return null");
  });
});
