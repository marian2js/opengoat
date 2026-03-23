import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(desktopSrc, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// AC12: Tabs component exists in components/ui/tabs.tsx (Radix-based)
// ---------------------------------------------------------------------------
describe("Tabs UI primitive", () => {
  it("tabs.tsx file exists", () => {
    expect(existsSync(resolve(desktopSrc, "components/ui/tabs.tsx"))).toBe(true);
  });

  it("wraps Radix tabs primitives", () => {
    const src = readSrc("components/ui/tabs.tsx");
    expect(src).toContain("radix-ui");
    expect(src).toContain("Tabs");
  });

  it("exports TabsList, TabsTrigger, TabsContent", () => {
    const src = readSrc("components/ui/tabs.tsx");
    expect(src).toContain("TabsList");
    expect(src).toContain("TabsTrigger");
    expect(src).toContain("TabsContent");
  });

  it("uses data-slot pattern", () => {
    const src = readSrc("components/ui/tabs.tsx");
    expect(src).toContain("data-slot");
  });
});

// ---------------------------------------------------------------------------
// AC1: Navigating to #objective/<id> renders ObjectiveWorkspace
// ---------------------------------------------------------------------------
describe("Routing — objective view", () => {
  const appSrc = readSrc("app/App.tsx");

  it("AppView type includes 'objective'", () => {
    expect(appSrc).toMatch(/objective/);
  });

  it("readViewFromHash parses #objective/ prefix", () => {
    expect(appSrc).toContain("#objective/");
  });

  it("renders ObjectiveWorkspace", () => {
    expect(appSrc).toContain("ObjectiveWorkspace");
  });

  it("tracks objectiveId state from hash", () => {
    expect(appSrc).toMatch(/objectiveId/);
  });

  it("tracks objectiveTab state from hash", () => {
    expect(appSrc).toMatch(/objectiveTab/);
  });
});

// ---------------------------------------------------------------------------
// ObjectiveWorkspace — page shell
// ---------------------------------------------------------------------------
describe("ObjectiveWorkspace", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/components/ObjectiveWorkspace.tsx"))).toBe(true);
  });

  it("has guard clause for missing props", () => {
    const src = readSrc("features/objectives/components/ObjectiveWorkspace.tsx");
    expect(src).toMatch(/!agentId|!client|!objectiveId/);
  });

  it("uses useObjectiveDetail hook", () => {
    const src = readSrc("features/objectives/components/ObjectiveWorkspace.tsx");
    expect(src).toContain("useObjectiveDetail");
  });

  it("renders ObjectiveQuickActions", () => {
    const src = readSrc("features/objectives/components/ObjectiveWorkspace.tsx");
    expect(src).toContain("ObjectiveQuickActions");
  });

  it("renders ObjectiveStatusBadge", () => {
    const src = readSrc("features/objectives/components/ObjectiveWorkspace.tsx");
    expect(src).toContain("ObjectiveStatusBadge");
  });
});

// ---------------------------------------------------------------------------
// AC2: Tab navigation shows 7 tabs
// ---------------------------------------------------------------------------
describe("ObjectiveTabNav — 7 tabs", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/components/ObjectiveTabNav.tsx"))).toBe(true);
  });

  it("renders Overview tab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain("Overview");
  });

  it("renders Runs tab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain("Runs");
  });

  it("renders Artifacts tab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain("Artifacts");
  });

  it("renders Tasks tab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain("Tasks");
  });

  it("renders Signals tab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain("Signals");
  });

  it("renders Memory tab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain("Memory");
  });

  it("renders Activity tab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain("Activity");
  });

  it("uses Tabs component from ui/tabs", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain("TabsList");
    expect(src).toContain("TabsTrigger");
    expect(src).toContain("TabsContent");
  });

  it("defaults to overview tab", () => {
    const src = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(src).toContain('"overview"');
  });
});

// ---------------------------------------------------------------------------
// AC3: Overview tab displays objective fields
// ---------------------------------------------------------------------------
describe("OverviewTab", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/components/OverviewTab.tsx"))).toBe(true);
  });

  it("displays summary", () => {
    const src = readSrc("features/objectives/components/OverviewTab.tsx");
    expect(src).toContain("summary");
  });

  it("displays whyNow", () => {
    const src = readSrc("features/objectives/components/OverviewTab.tsx");
    expect(src).toContain("whyNow");
  });

  it("displays successDefinition", () => {
    const src = readSrc("features/objectives/components/OverviewTab.tsx");
    expect(src).toContain("successDefinition");
  });

  it("displays constraints", () => {
    const src = readSrc("features/objectives/components/OverviewTab.tsx");
    expect(src).toContain("constraints");
  });

  it("has suggested next move placeholder", () => {
    const src = readSrc("features/objectives/components/OverviewTab.tsx");
    expect(src).toMatch(/[Ss]uggested [Nn]ext [Mm]ove/i);
  });
});

// ---------------------------------------------------------------------------
// AC4: Runs tab lists runs with columns
// ---------------------------------------------------------------------------
describe("RunsTab", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/components/RunsTab.tsx"))).toBe(true);
  });

  it("uses useObjectiveRuns hook", () => {
    const src = readSrc("features/objectives/components/RunsTab.tsx");
    expect(src).toContain("useObjectiveRuns");
  });

  it("shows status badge", () => {
    const src = readSrc("features/objectives/components/RunsTab.tsx");
    expect(src).toContain("status");
  });

  it("shows phase column", () => {
    const src = readSrc("features/objectives/components/RunsTab.tsx");
    expect(src).toContain("phase");
  });

  it("shows playbook reference", () => {
    const src = readSrc("features/objectives/components/RunsTab.tsx");
    expect(src).toContain("playbookId");
  });

  it("has resume action button", () => {
    const src = readSrc("features/objectives/components/RunsTab.tsx");
    expect(src).toMatch(/[Rr]esume/);
  });

  it("has empty state", () => {
    const src = readSrc("features/objectives/components/RunsTab.tsx");
    expect(src).toMatch(/[Nn]o runs/i);
  });
});

// ---------------------------------------------------------------------------
// AC5: Artifacts tab grouped by status
// ---------------------------------------------------------------------------
describe("ArtifactsTab", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/components/ArtifactsTab.tsx"))).toBe(true);
  });

  it("uses useObjectiveArtifacts hook", () => {
    const src = readSrc("features/objectives/components/ArtifactsTab.tsx");
    expect(src).toContain("useObjectiveArtifacts");
  });

  it("groups by status", () => {
    const src = readSrc("features/objectives/components/ArtifactsTab.tsx");
    expect(src).toMatch(/group|Group/);
  });

  it("shows type badge", () => {
    const src = readSrc("features/objectives/components/ArtifactsTab.tsx");
    expect(src).toContain("type");
  });

  it("has empty state", () => {
    const src = readSrc("features/objectives/components/ArtifactsTab.tsx");
    expect(src).toMatch(/[Nn]o artifacts/i);
  });
});

// ---------------------------------------------------------------------------
// AC6: Tasks tab reuses board components
// ---------------------------------------------------------------------------
describe("TasksTab", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/components/TasksTab.tsx"))).toBe(true);
  });

  it("reuses TaskList from board", () => {
    const src = readSrc("features/objectives/components/TasksTab.tsx");
    expect(src).toContain("TaskList");
  });

  it("has empty state", () => {
    const src = readSrc("features/objectives/components/TasksTab.tsx");
    expect(src).toMatch(/[Nn]o tasks/i);
  });
});

// ---------------------------------------------------------------------------
// AC7 + AC8: Placeholder tabs
// ---------------------------------------------------------------------------
describe("PlaceholderTab", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/components/PlaceholderTab.tsx"))).toBe(true);
  });

  it("shows coming soon message", () => {
    const src = readSrc("features/objectives/components/PlaceholderTab.tsx");
    expect(src).toMatch(/[Cc]oming [Ss]oon/i);
  });
});

// ---------------------------------------------------------------------------
// AC9: Quick actions for status changes
// ---------------------------------------------------------------------------
describe("ObjectiveQuickActions", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/components/ObjectiveQuickActions.tsx"))).toBe(true);
  });

  it("has active status button", () => {
    const src = readSrc("features/objectives/components/ObjectiveQuickActions.tsx");
    expect(src).toMatch(/[Aa]ctive/);
  });

  it("has paused status button", () => {
    const src = readSrc("features/objectives/components/ObjectiveQuickActions.tsx");
    expect(src).toMatch(/[Pp]aused?/);
  });

  it("has completed status button", () => {
    const src = readSrc("features/objectives/components/ObjectiveQuickActions.tsx");
    expect(src).toMatch(/[Cc]omplete/);
  });

  it("has abandoned status button", () => {
    const src = readSrc("features/objectives/components/ObjectiveQuickActions.tsx");
    expect(src).toMatch(/[Aa]bandon/);
  });

  it("calls client.updateObjective for status changes", () => {
    const src = readSrc("features/objectives/components/ObjectiveQuickActions.tsx");
    expect(src).toContain("updateObjective");
  });
});

// ---------------------------------------------------------------------------
// ObjectiveStatusBadge
// ---------------------------------------------------------------------------
describe("ObjectiveStatusBadge", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/components/ObjectiveStatusBadge.tsx"))).toBe(true);
  });

  it("renders monospace uppercase status", () => {
    const src = readSrc("features/objectives/components/ObjectiveStatusBadge.tsx");
    expect(src).toContain("font-mono");
    expect(src).toContain("uppercase");
  });

  it("has color dot", () => {
    const src = readSrc("features/objectives/components/ObjectiveStatusBadge.tsx");
    expect(src).toContain("rounded-full");
  });
});

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------
describe("useObjectiveDetail hook", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/hooks/useObjectiveDetail.ts"))).toBe(true);
  });

  it("calls client.getObjective", () => {
    const src = readSrc("features/objectives/hooks/useObjectiveDetail.ts");
    expect(src).toContain("client.getObjective");
  });

  it("returns objective, isLoading, error, refresh", () => {
    const src = readSrc("features/objectives/hooks/useObjectiveDetail.ts");
    expect(src).toContain("objective");
    expect(src).toContain("isLoading");
    expect(src).toContain("error");
    expect(src).toContain("refresh");
  });

  it("handles cancellation", () => {
    const src = readSrc("features/objectives/hooks/useObjectiveDetail.ts");
    expect(src).toContain("cancelled");
  });
});

describe("useObjectiveRuns hook", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/hooks/useObjectiveRuns.ts"))).toBe(true);
  });

  it("calls client.listRuns with objectiveId", () => {
    const src = readSrc("features/objectives/hooks/useObjectiveRuns.ts");
    expect(src).toContain("client.listRuns");
    expect(src).toContain("objectiveId");
  });

  it("returns runs, isLoading, error, refresh", () => {
    const src = readSrc("features/objectives/hooks/useObjectiveRuns.ts");
    expect(src).toContain("runs");
    expect(src).toContain("isLoading");
    expect(src).toContain("error");
    expect(src).toContain("refresh");
  });
});

describe("useObjectiveArtifacts hook", () => {
  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, "features/objectives/hooks/useObjectiveArtifacts.ts"))).toBe(true);
  });

  it("calls client.listArtifacts with objectiveId", () => {
    const src = readSrc("features/objectives/hooks/useObjectiveArtifacts.ts");
    expect(src).toContain("client.listArtifacts");
    expect(src).toContain("objectiveId");
  });

  it("groups artifacts by status", () => {
    const src = readSrc("features/objectives/hooks/useObjectiveArtifacts.ts");
    expect(src).toMatch(/group|Group/);
  });

  it("returns items, isLoading, error, refresh", () => {
    const src = readSrc("features/objectives/hooks/useObjectiveArtifacts.ts");
    expect(src).toContain("isLoading");
    expect(src).toContain("error");
    expect(src).toContain("refresh");
  });
});

// ---------------------------------------------------------------------------
// AC10: Deep linking
// ---------------------------------------------------------------------------
describe("Deep linking", () => {
  it("readViewFromHash handles #objective/<id>", () => {
    const src = readSrc("app/App.tsx");
    expect(src).toContain("#objective/");
  });

  it("tab navigation syncs with hash", () => {
    const navSrc = readSrc("features/objectives/components/ObjectiveTabNav.tsx");
    expect(navSrc).toContain("location.hash");
  });
});

// ---------------------------------------------------------------------------
// AC11: UI matches DESIGN.md
// ---------------------------------------------------------------------------
describe("Design system compliance", () => {
  it("ObjectiveStatusBadge uses teal for active", () => {
    const src = readSrc("features/objectives/components/ObjectiveStatusBadge.tsx");
    expect(src).toMatch(/primary|teal/);
  });

  it("OverviewTab uses section-label pattern", () => {
    const src = readSrc("features/objectives/components/OverviewTab.tsx");
    expect(src).toMatch(/section-label|font-mono.*uppercase/);
  });

  it("ObjectiveWorkspace uses font-display for heading", () => {
    const src = readSrc("features/objectives/components/ObjectiveWorkspace.tsx");
    expect(src).toContain("font-display");
  });
});

// ---------------------------------------------------------------------------
// AC: Loading and error states
// ---------------------------------------------------------------------------
describe("Loading and error states", () => {
  it("ObjectiveWorkspace shows loading skeleton", () => {
    const src = readSrc("features/objectives/components/ObjectiveWorkspace.tsx");
    expect(src).toContain("Skeleton");
  });

  it("RunsTab has loading state", () => {
    const src = readSrc("features/objectives/components/RunsTab.tsx");
    expect(src).toContain("isLoading");
  });

  it("ArtifactsTab has loading state", () => {
    const src = readSrc("features/objectives/components/ArtifactsTab.tsx");
    expect(src).toContain("isLoading");
  });
});

// ---------------------------------------------------------------------------
// Dashboard wiring
// ---------------------------------------------------------------------------
describe("Dashboard entry point", () => {
  it("ActiveObjectiveSection onOpenObjective navigates to objective hash", () => {
    const src = readSrc("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).toContain("#objective/");
  });
});
