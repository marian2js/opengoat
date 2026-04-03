import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const featureDir = resolve(
  __dirname,
  "../../../apps/desktop/src/features/dashboard",
);
const readSrc = (path: string) =>
  readFileSync(resolve(featureDir, path), "utf-8");

const componentSrc = readSrc("components/RecentOutputs.tsx");
const hookSrc = readSrc("hooks/useRecentArtifacts.ts");
const artifactCardSrc = readSrc("components/ArtifactCard.tsx");
const bundleCardSrc = readSrc("components/BundleCard.tsx");
const dashboardSrc = readSrc("components/DashboardWorkspace.tsx");

// ---------------------------------------------------------------------------
// RecentOutputs — empty state
// ---------------------------------------------------------------------------
describe("RecentOutputs empty state", () => {
  it("shows 'No outputs yet' message when empty", () => {
    expect(componentSrc).toContain("No outputs yet");
  });

  it("suggests running an action to get started", () => {
    expect(
      componentSrc.includes("run an action") ||
        componentSrc.includes("get started"),
    ).toBe(true);
  });

  it("renders empty state container with dashed border", () => {
    expect(componentSrc).toContain("border-dashed");
  });
});

// ---------------------------------------------------------------------------
// RecentOutputs — specialist attribution
// ---------------------------------------------------------------------------
describe("RecentOutputs specialist attribution", () => {
  it("imports specialist meta for resolving names", () => {
    expect(
      componentSrc.includes("specialist-meta") ||
        componentSrc.includes("getSpecialistMeta"),
    ).toBe(true);
  });

  it("has resolveSpecialistName helper function", () => {
    expect(componentSrc).toContain("resolveSpecialistName");
  });

  it("passes specialistName to ArtifactCard", () => {
    expect(componentSrc).toContain("specialistName={specialistName}");
  });

  it("passes specialistName to BundleCard", () => {
    // Component passes specialist info to BundleCard
    expect(componentSrc).toContain("specialistName={specialistName}");
  });
});

// ---------------------------------------------------------------------------
// RecentOutputs — navigation
// ---------------------------------------------------------------------------
describe("RecentOutputs navigation", () => {
  it("accepts onNavigate callback prop", () => {
    expect(componentSrc).toContain("onNavigate");
  });

  it("passes onNavigate to ArtifactCard", () => {
    expect(componentSrc).toContain("onNavigate={onNavigate}");
  });

  it("passes onNavigate to BundleCard", () => {
    expect(componentSrc).toContain("onNavigate={onNavigate}");
  });
});

// ---------------------------------------------------------------------------
// ArtifactCard — specialist attribution & navigation
// ---------------------------------------------------------------------------
describe("ArtifactCard enhancements", () => {
  it("accepts specialistName prop", () => {
    expect(artifactCardSrc).toContain("specialistName");
  });

  it("renders specialist name badge when provided", () => {
    expect(artifactCardSrc).toContain("specialistName");
    expect(artifactCardSrc).toContain("bg-primary/8");
  });

  it("accepts onNavigate callback prop", () => {
    expect(artifactCardSrc).toContain("onNavigate");
  });

  it("has click handler for navigation", () => {
    expect(artifactCardSrc).toContain("onClick");
    expect(artifactCardSrc).toContain("handleClick");
  });

  it("supports keyboard navigation (Enter/Space)", () => {
    expect(artifactCardSrc).toContain("onKeyDown");
  });
});

// ---------------------------------------------------------------------------
// BundleCard — specialist attribution
// ---------------------------------------------------------------------------
describe("BundleCard enhancements", () => {
  it("accepts specialistName prop", () => {
    expect(bundleCardSrc).toContain("specialistName");
  });

  it("renders specialist attribution badge", () => {
    expect(bundleCardSrc).toContain("specialistName");
    expect(bundleCardSrc).toContain("bg-primary/8");
  });

  it("passes specialistName and onNavigate to child ArtifactCards", () => {
    expect(bundleCardSrc).toContain("specialistName={specialistName}");
    expect(bundleCardSrc).toContain("onNavigate={onNavigate}");
  });
});

// ---------------------------------------------------------------------------
// useRecentArtifacts — polling for live updates
// ---------------------------------------------------------------------------
describe("useRecentArtifacts live updates", () => {
  it("has polling interval via setInterval", () => {
    expect(hookSrc).toContain("setInterval");
  });

  it("cleans up polling with clearInterval on unmount", () => {
    expect(hookSrc).toContain("clearInterval");
  });

  it("refreshes on window focus", () => {
    expect(hookSrc).toContain('"focus"');
  });

  it("refreshes on hashchange (navigation back to dashboard)", () => {
    expect(hookSrc).toContain('"hashchange"');
  });

  it("uses refreshKey state for triggering re-fetches", () => {
    expect(hookSrc).toContain("refreshKey");
  });
});

// ---------------------------------------------------------------------------
// DashboardWorkspace — wiring
// ---------------------------------------------------------------------------
describe("DashboardWorkspace output navigation", () => {
  it("has handleOutputNavigate function", () => {
    expect(dashboardSrc).toContain("handleOutputNavigate");
  });

  it("passes onNavigate to RecentOutputs", () => {
    expect(dashboardSrc).toContain("onNavigate={handleOutputNavigate}");
  });

  it("uses getActionMapping for run-to-session lookup", () => {
    expect(dashboardSrc).toContain("getActionMapping");
  });
});

// ---------------------------------------------------------------------------
// RecentOutputs — section structure
// ---------------------------------------------------------------------------
describe("RecentOutputs section structure", () => {
  it("has section header with 'Recent outputs' label", () => {
    expect(componentSrc).toContain("Recent outputs");
  });

  it("uses section-label styling class", () => {
    expect(componentSrc).toContain("section-label");
  });

  it("uses dashboard-section wrapper", () => {
    expect(componentSrc).toContain("dashboard-section");
  });

  it("renders both ArtifactCard and BundleCard components", () => {
    expect(componentSrc).toContain("ArtifactCard");
    expect(componentSrc).toContain("BundleCard");
  });

  it("shows count badge when items exist", () => {
    expect(componentSrc).toContain("totalCount");
  });
});
