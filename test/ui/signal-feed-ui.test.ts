import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(desktopSrc, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// Phase 1: Signal config — icons
// ---------------------------------------------------------------------------
describe("signal-icons config", () => {
  const filePath = "features/signals/lib/signal-icons.ts";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports SOURCE_TYPE_ICONS mapping", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SOURCE_TYPE_ICONS");
  });

  it("maps all 6 source types to lucide icons", () => {
    const src = readSrc(filePath);
    expect(src).toContain("web");
    expect(src).toContain("competitor");
    expect(src).toContain("community");
    expect(src).toContain("seo");
    expect(src).toContain("ai-search");
    expect(src).toContain("workspace");
    expect(src).toContain("Globe");
    expect(src).toContain("Target");
    expect(src).toContain("Users");
    expect(src).toContain("Search");
    expect(src).toContain("Sparkles");
    expect(src).toContain("Folder");
  });

  it("exports SOURCE_TYPE_LABELS with human-readable labels", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SOURCE_TYPE_LABELS");
    expect(src).toContain("Web");
    expect(src).toContain("Competitor");
    expect(src).toContain("Community");
    expect(src).toContain("SEO");
    expect(src).toContain("AI Search");
    expect(src).toContain("Workspace");
  });
});

// ---------------------------------------------------------------------------
// Phase 1: Signal config — colors
// ---------------------------------------------------------------------------
describe("signal-colors config", () => {
  const filePath = "features/signals/lib/signal-colors.ts";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports IMPORTANCE_COLORS mapping", () => {
    const src = readSrc(filePath);
    expect(src).toContain("IMPORTANCE_COLORS");
  });

  it("maps all 4 importance levels with accent and badge classes", () => {
    const src = readSrc(filePath);
    expect(src).toContain("low");
    expect(src).toContain("medium");
    expect(src).toContain("high");
    expect(src).toContain("critical");
    expect(src).toContain("accent");
    expect(src).toContain("badge");
  });

  it("uses correct color scheme: gray/amber/orange/red", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/muted/); // low = muted/gray
    expect(src).toMatch(/amber/); // medium = amber
    expect(src).toMatch(/orange/); // high = orange
    expect(src).toMatch(/red/); // critical = red
  });

  it("exports FRESHNESS_CONFIG mapping", () => {
    const src = readSrc(filePath);
    expect(src).toContain("FRESHNESS_CONFIG");
    expect(src).toContain("fresh");
    expect(src).toContain("recent");
    expect(src).toContain("aging");
    expect(src).toContain("stale");
    expect(src).toContain("label");
  });
});

// ---------------------------------------------------------------------------
// Phase 2: useSignals hook
// ---------------------------------------------------------------------------
describe("useSignals hook", () => {
  const filePath = "features/signals/hooks/useSignals.ts";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports useSignals function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function useSignals/);
  });

  it("imports SidecarClient", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SidecarClient");
  });

  it("calls client.listSignals with filter params", () => {
    const src = readSrc(filePath);
    expect(src).toContain("listSignals");
  });

  it("returns signals, total, isLoading, error, and refresh", () => {
    const src = readSrc(filePath);
    expect(src).toContain("signals");
    expect(src).toContain("total");
    expect(src).toContain("isLoading");
    expect(src).toContain("error");
    expect(src).toContain("refresh");
  });

  it("uses cancellation flag pattern", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/cancelled|canceled/);
  });

  it("uses refreshKey pattern for manual refresh", () => {
    const src = readSrc(filePath);
    expect(src).toContain("refreshKey");
  });

  it("supports objectiveId filtering", () => {
    const src = readSrc(filePath);
    expect(src).toContain("objectiveId");
  });

  it("supports status and sourceType filtering", () => {
    const src = readSrc(filePath);
    expect(src).toContain("status");
    expect(src).toContain("sourceType");
  });
});

// ---------------------------------------------------------------------------
// Phase 2: useSignalActions hook
// ---------------------------------------------------------------------------
describe("useSignalActions hook", () => {
  const filePath = "features/signals/hooks/useSignalActions.ts";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports useSignalActions function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function useSignalActions/);
  });

  it("imports SidecarClient", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SidecarClient");
  });

  it("provides saveSignal action that calls updateSignalStatus", () => {
    const src = readSrc(filePath);
    expect(src).toContain("saveSignal");
    expect(src).toContain("updateSignalStatus");
  });

  it("provides dismissSignal action", () => {
    const src = readSrc(filePath);
    expect(src).toContain("dismissSignal");
  });

  it("provides promoteSignal action", () => {
    const src = readSrc(filePath);
    expect(src).toContain("promoteSignal");
  });

  it("tracks loading state per signal ID", () => {
    const src = readSrc(filePath);
    expect(src).toContain("actionLoading");
  });

  it("accepts onSuccess callback for refresh", () => {
    const src = readSrc(filePath);
    expect(src).toContain("onSuccess");
  });
});

// ---------------------------------------------------------------------------
// Phase 3: SignalCard component
// ---------------------------------------------------------------------------
describe("SignalCard component", () => {
  const filePath = "features/signals/components/SignalCard.tsx";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports SignalCard function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function SignalCard/);
  });

  it("accepts signal prop with Signal type", () => {
    const src = readSrc(filePath);
    expect(src).toContain("signal");
    expect(src).toContain("Signal");
  });

  it("renders signal title", () => {
    const src = readSrc(filePath);
    expect(src).toContain("signal.title");
  });

  it("renders signal summary with line clamp", () => {
    const src = readSrc(filePath);
    expect(src).toContain("signal.summary");
    expect(src).toContain("line-clamp");
  });

  it("renders importance badge using IMPORTANCE_COLORS", () => {
    const src = readSrc(filePath);
    expect(src).toContain("IMPORTANCE_COLORS");
    expect(src).toContain("signal.importance");
  });

  it("renders source type icon using SOURCE_TYPE_ICONS", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SOURCE_TYPE_ICONS");
    expect(src).toContain("signal.sourceType");
  });

  it("renders freshness indicator using FRESHNESS_CONFIG", () => {
    const src = readSrc(filePath);
    expect(src).toContain("FRESHNESS_CONFIG");
    expect(src).toContain("signal.freshness");
  });

  it("has left accent bar colored by importance", () => {
    const src = readSrc(filePath);
    // Left accent bar pattern from OpportunityCard
    expect(src).toMatch(/w-\[3px\]/);
    expect(src).toContain("accent");
  });

  it("renders action buttons: Save, Dismiss, Promote", () => {
    const src = readSrc(filePath);
    expect(src).toContain("onSave");
    expect(src).toContain("onDismiss");
    expect(src).toContain("onPromote");
    expect(src).toContain("Bookmark");
    expect(src).toContain("ArrowUp");
  });

  it("follows OpportunityCard styling pattern", () => {
    const src = readSrc(filePath);
    expect(src).toContain("rounded-lg");
    expect(src).toContain("border-border/50");
    expect(src).toContain("bg-card/80");
  });

  it("supports hover effects", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/hover:/);
  });
});

// ---------------------------------------------------------------------------
// Phase 4: SignalFeed component
// ---------------------------------------------------------------------------
describe("SignalFeed component", () => {
  const filePath = "features/signals/components/SignalFeed.tsx";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports SignalFeed function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function SignalFeed/);
  });

  it("accepts client and filters props", () => {
    const src = readSrc(filePath);
    expect(src).toContain("client");
    expect(src).toContain("filters");
  });

  it("uses useSignals hook", () => {
    const src = readSrc(filePath);
    expect(src).toContain("useSignals");
  });

  it("uses useSignalActions hook", () => {
    const src = readSrc(filePath);
    expect(src).toContain("useSignalActions");
  });

  it("renders SignalCard for each signal", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SignalCard");
  });

  it("shows loading skeleton state", () => {
    const src = readSrc(filePath);
    expect(src).toContain("isLoading");
    expect(src).toContain("Skeleton");
  });

  it("shows empty state with configurable message", () => {
    const src = readSrc(filePath);
    expect(src).toContain("emptyMessage");
    expect(src).toContain("No signals yet");
  });

  it("supports optional filter controls via showFilters prop", () => {
    const src = readSrc(filePath);
    expect(src).toContain("showFilters");
  });

  it("has filter controls for sourceType and status", () => {
    const src = readSrc(filePath);
    expect(src).toContain("sourceType");
    expect(src).toContain("status");
    expect(src).toContain("Select");
  });
});

// ---------------------------------------------------------------------------
// Phase 5: SignalsTab component
// ---------------------------------------------------------------------------
describe("SignalsTab component", () => {
  const filePath = "features/signals/components/SignalsTab.tsx";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports SignalsTab function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function SignalsTab/);
  });

  it("accepts objectiveId and client props", () => {
    const src = readSrc(filePath);
    expect(src).toContain("objectiveId");
    expect(src).toContain("client");
  });

  it("renders SignalFeed with objectiveId filter", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SignalFeed");
    expect(src).toContain("objectiveId");
  });

  it("enables filter controls", () => {
    const src = readSrc(filePath);
    expect(src).toContain("showFilters");
  });

  it("provides objective-specific empty message", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/[Nn]o signals/);
    expect(src).toMatch(/objective/);
  });
});

// ---------------------------------------------------------------------------
// Phase 5: ObjectiveTabNav wiring
// ---------------------------------------------------------------------------
describe("ObjectiveTabNav — Signals tab wired", () => {
  it("imports SignalsTab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain("SignalsTab");
  });

  it("renders SignalsTab instead of PlaceholderTab for signals", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    const signalsTabStart = src.indexOf('value="signals"');
    expect(signalsTabStart).toBeGreaterThan(-1);
    const signalsTabEnd = src.indexOf("</TabsContent>", signalsTabStart);
    const signalsSection = src.slice(signalsTabStart, signalsTabEnd);
    expect(signalsSection).toContain("SignalsTab");
    expect(signalsSection).not.toContain("PlaceholderTab");
  });

  it("passes objectiveId and client to SignalsTab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    const signalsTabStart = src.indexOf('value="signals"');
    const signalsTabEnd = src.indexOf("</TabsContent>", signalsTabStart);
    const signalsSection = src.slice(signalsTabStart, signalsTabEnd);
    expect(signalsSection).toContain("objectiveId");
    expect(signalsSection).toContain("client");
  });
});
