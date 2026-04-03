import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");
const readFile = (relPath: string) =>
  readFileSync(resolve(desktopSrc, relPath), "utf-8");

// ═══════════════════════════════════════════════════════
// 1. handleOutputNavigate uses onResumeRun for session navigation
// ═══════════════════════════════════════════════════════

describe("handleOutputNavigate routes through onResumeRun", () => {
  it("calls onResumeRun when session ID is found via action map", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    // The handler should call onResumeRun with the sessionId when found
    expect(src).toContain("onResumeRun");
    // It should use onResumeRun inside handleOutputNavigate, not just window.location.hash
    const handlerStart = src.indexOf("function handleOutputNavigate");
    const handlerEnd = src.indexOf("}", src.indexOf("// Last resort", handlerStart));
    const handlerBody = src.slice(handlerStart, handlerEnd);
    expect(handlerBody).toContain("onResumeRun");
  });

  it("does not navigate via raw window.location.hash when sessionId is found", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    const handlerStart = src.indexOf("function handleOutputNavigate");
    const handlerEnd = src.indexOf("}", src.indexOf("// Last resort", handlerStart));
    const handlerBody = src.slice(handlerStart, handlerEnd);
    // When sessionId is found, should use onResumeRun, not direct hash set
    // The only direct hash sets should be for the fallback paths
    const sessionIdBlock = handlerBody.slice(
      handlerBody.indexOf("if (sessionId)"),
      handlerBody.indexOf("return;", handlerBody.indexOf("if (sessionId)")) + 7,
    );
    expect(sessionIdBlock).not.toContain('window.location.hash = "#chat"');
    expect(sessionIdBlock).not.toContain('window.location.hash = "#action-session"');
  });
});

// ═══════════════════════════════════════════════════════
// 2. Fallback navigation to specialist chat
// ═══════════════════════════════════════════════════════

describe("handleOutputNavigate fallback to specialist chat", () => {
  it("falls back to specialist chat when no session mapping exists", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    const handlerStart = src.indexOf("function handleOutputNavigate");
    const handlerEnd = src.indexOf("}", src.indexOf("// Last resort", handlerStart));
    const handlerBody = src.slice(handlerStart, handlerEnd);
    expect(handlerBody).toContain("specialist=");
    expect(handlerBody).toContain("artifact.createdBy");
  });

  it("has a last resort fallback to general chat", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    const handlerStart = src.indexOf("function handleOutputNavigate");
    const handlerEnd = src.indexOf("}", src.indexOf("// Last resort", handlerStart));
    const handlerBody = src.slice(handlerStart, handlerEnd);
    expect(handlerBody).toContain('window.location.hash = "#chat"');
  });
});

// ═══════════════════════════════════════════════════════
// 3. ArtifactCard triggers onNavigate on click
// ═══════════════════════════════════════════════════════

describe("ArtifactCard navigates on click", () => {
  it("calls onNavigate when clicked", () => {
    const src = readFile("features/dashboard/components/ArtifactCard.tsx");
    expect(src).toContain("onNavigate(artifact)");
  });

  it("has role=button when onNavigate is provided", () => {
    const src = readFile("features/dashboard/components/ArtifactCard.tsx");
    expect(src).toContain('role={onNavigate ? "button"');
  });

  it("supports keyboard navigation with Enter and Space", () => {
    const src = readFile("features/dashboard/components/ArtifactCard.tsx");
    expect(src).toContain('"Enter"');
    expect(src).toContain('" "');
  });

  it("shows OPEN label when onNavigate is provided", () => {
    const src = readFile("features/dashboard/components/ArtifactCard.tsx");
    expect(src).toContain("Open");
    expect(src).toContain("onNavigate ?");
  });
});

// ═══════════════════════════════════════════════════════
// 4. RecentOutputs passes onNavigate to cards
// ═══════════════════════════════════════════════════════

describe("RecentOutputs wires onNavigate to child cards", () => {
  it("passes onNavigate to ArtifactCard", () => {
    const src = readFile("features/dashboard/components/RecentOutputs.tsx");
    expect(src).toContain("onNavigate={onNavigate}");
  });

  it("passes onNavigate to BundleCard", () => {
    const src = readFile("features/dashboard/components/RecentOutputs.tsx");
    // BundleCard should also receive onNavigate
    const bundleCardMatch = src.match(/<BundleCard[\s\S]*?\/>/);
    expect(bundleCardMatch).not.toBeNull();
    expect(bundleCardMatch![0]).toContain("onNavigate={onNavigate}");
  });
});

// ═══════════════════════════════════════════════════════
// 5. DashboardWorkspace passes onNavigate to RecentOutputs
// ═══════════════════════════════════════════════════════

describe("DashboardWorkspace wires handleOutputNavigate to RecentOutputs", () => {
  it("passes handleOutputNavigate as onNavigate to RecentOutputs", () => {
    const src = readFile("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("onNavigate={handleOutputNavigate}");
  });
});
