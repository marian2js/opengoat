import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const desktopSrc = resolve(__dirname, "../../apps/desktop/src");

function readSrc(relativePath: string): string {
  return readFileSync(resolve(desktopSrc, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// Phase 1: last-visited localStorage helper
// ---------------------------------------------------------------------------
describe("last-visited helper", () => {
  const filePath = "features/dashboard/lib/last-visited.ts";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports getLastVisited function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function getLastVisited/);
  });

  it("exports setLastVisited function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function setLastVisited/);
  });

  it("uses localStorage with proper prefix", () => {
    const src = readSrc(filePath);
    expect(src).toContain("localStorage");
    expect(src).toContain("opengoat:last-visited:");
  });

  it("uses try-catch for error handling", () => {
    const src = readSrc(filePath);
    expect(src).toContain("catch");
  });
});

// ---------------------------------------------------------------------------
// Phase 2: feed-item-types
// ---------------------------------------------------------------------------
describe("feed-item-types", () => {
  const filePath = "features/dashboard/lib/feed-item-types.ts";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports FeedItem interface", () => {
    const src = readSrc(filePath);
    expect(src).toContain("FeedItem");
  });

  it("exports FeedItemType union", () => {
    const src = readSrc(filePath);
    expect(src).toContain("FeedItemType");
    expect(src).toContain("signal");
    expect(src).toContain("blocked-task");
    expect(src).toContain("pending-task");
  });

  it("exports mapSignalToFeedItem mapper", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function mapSignalToFeedItem/);
  });

  it("exports mapBlockedTaskToFeedItem mapper", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function mapBlockedTaskToFeedItem/);
  });

  it("exports mapPendingTaskToFeedItem mapper", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function mapPendingTaskToFeedItem/);
  });

  it("exports mergeFeedItems function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function mergeFeedItems/);
  });

  it("uses signal icons and colors from signals lib", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SOURCE_TYPE_ICONS");
    expect(src).toContain("IMPORTANCE_COLORS");
  });

  it("uses CircleSlash for blocked tasks and Clock for pending", () => {
    const src = readSrc(filePath);
    expect(src).toContain("CircleSlash");
    expect(src).toContain("Clock");
  });

  it("mergeFeedItems sorts by timestamp descending and caps at 10", () => {
    const src = readSrc(filePath);
    expect(src).toContain("sort");
    expect(src).toContain("slice");
    expect(src).toContain("10");
  });
});

// ---------------------------------------------------------------------------
// Phase 3: useSinceYouWereAway hook
// ---------------------------------------------------------------------------
describe("useSinceYouWereAway hook", () => {
  const filePath = "features/dashboard/hooks/useSinceYouWereAway.ts";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports useSinceYouWereAway function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function useSinceYouWereAway/);
  });

  it("imports SidecarClient", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SidecarClient");
  });

  it("calls detectWorkspaceSignals", () => {
    const src = readSrc(filePath);
    expect(src).toContain("detectWorkspaceSignals");
  });

  it("fetches signals and tasks in parallel with Promise.all", () => {
    const src = readSrc(filePath);
    expect(src).toContain("Promise.all");
    expect(src).toContain("listSignals");
    expect(src).toContain("listTasks");
  });

  it("uses feed item mappers", () => {
    const src = readSrc(filePath);
    expect(src).toContain("mapSignalToFeedItem");
    expect(src).toContain("mapBlockedTaskToFeedItem");
    expect(src).toContain("mapPendingTaskToFeedItem");
  });

  it("uses last-visited helpers for filtering", () => {
    const src = readSrc(filePath);
    expect(src).toContain("getLastVisited");
    expect(src).toContain("setLastVisited");
  });

  it("uses cancellation flag pattern", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/cancelled|canceled/);
  });

  it("returns items, isLoading, isEmpty, refresh", () => {
    const src = readSrc(filePath);
    expect(src).toContain("items");
    expect(src).toContain("isLoading");
    expect(src).toContain("isEmpty");
    expect(src).toContain("refresh");
  });
});

// ---------------------------------------------------------------------------
// Phase 4: FeedItem component
// ---------------------------------------------------------------------------
describe("FeedItem component", () => {
  const filePath = "features/dashboard/components/FeedItem.tsx";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports FeedItemCard function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function FeedItemCard/);
  });

  it("accepts item prop with FeedItem type", () => {
    const src = readSrc(filePath);
    expect(src).toContain("FeedItem");
  });

  it("renders item title", () => {
    const src = readSrc(filePath);
    expect(src).toContain("item.title");
  });

  it("renders item summary with line clamp", () => {
    const src = readSrc(filePath);
    expect(src).toContain("item.summary");
    expect(src).toContain("line-clamp");
  });

  it("has left accent bar", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/w-\[3px\]/);
    expect(src).toContain("accentColor");
  });

  it("follows OpportunityCard styling pattern", () => {
    const src = readSrc(filePath);
    expect(src).toContain("rounded-lg");
    expect(src).toContain("border-border/50");
    expect(src).toContain("bg-card/80");
  });

  it("renders type badge", () => {
    const src = readSrc(filePath);
    expect(src).toContain("item.type");
  });

  it("renders action button when action exists", () => {
    const src = readSrc(filePath);
    expect(src).toContain("item.action");
  });
});

// ---------------------------------------------------------------------------
// Phase 5: SinceYouWereAwaySection component
// ---------------------------------------------------------------------------
describe("SinceYouWereAwaySection component", () => {
  const filePath = "features/dashboard/components/SinceYouWereAwaySection.tsx";

  it("file exists", () => {
    expect(existsSync(resolve(desktopSrc, filePath))).toBe(true);
  });

  it("exports SinceYouWereAwaySection function", () => {
    const src = readSrc(filePath);
    expect(src).toMatch(/export function SinceYouWereAwaySection/);
  });

  it("accepts client, agentId, projectId props", () => {
    const src = readSrc(filePath);
    expect(src).toContain("client");
    expect(src).toContain("agentId");
    expect(src).toContain("projectId");
  });

  it("uses useSinceYouWereAway hook", () => {
    const src = readSrc(filePath);
    expect(src).toContain("useSinceYouWereAway");
  });

  it("returns null when empty and not loading", () => {
    const src = readSrc(filePath);
    expect(src).toContain("isEmpty");
    expect(src).toContain("null");
  });

  it("renders section header with mono uppercase label", () => {
    const src = readSrc(filePath);
    expect(src).toContain("SINCE YOU WERE AWAY");
    expect(src).toContain("font-mono");
    expect(src).toContain("uppercase");
  });

  it("renders FeedItemCard for each item", () => {
    const src = readSrc(filePath);
    expect(src).toContain("FeedItemCard");
  });

  it("shows loading skeleton state", () => {
    const src = readSrc(filePath);
    expect(src).toContain("isLoading");
    expect(src).toContain("Skeleton");
  });
});

// ---------------------------------------------------------------------------
// Phase 6: DashboardWorkspace integration
// ---------------------------------------------------------------------------
// Sprint 5: SinceYouWereAwaySection removed from dashboard default flow.
// The component still exists but is no longer rendered in DashboardWorkspace.
describe("DashboardWorkspace — SinceYouWereAway removed from dashboard", () => {
  it("does not import SinceYouWereAwaySection", () => {
    const src = readSrc("features/dashboard/components/DashboardWorkspace.tsx");
    expect(src).not.toContain("SinceYouWereAwaySection");
  });
});

// ---------------------------------------------------------------------------
// Phase 7: WorkspaceSignalDetector core
// ---------------------------------------------------------------------------
describe("WorkspaceSignalDetector", () => {
  const filePath = resolve(
    __dirname,
    "../../packages/core/src/core/signals/application/workspace-signal-detector.ts",
  );

  it("file exists", () => {
    expect(existsSync(filePath)).toBe(true);
  });

  it("exports WorkspaceSignalDetector class", () => {
    const src = readFileSync(filePath, "utf-8");
    expect(src).toMatch(/export class WorkspaceSignalDetector/);
  });

  it("has detectAndCreateSignals method", () => {
    const src = readFileSync(filePath, "utf-8");
    expect(src).toContain("detectAndCreateSignals");
  });

  it("detects blocked tasks", () => {
    const src = readFileSync(filePath, "utf-8");
    expect(src).toContain("blocked");
  });

  it("detects pending tasks", () => {
    const src = readFileSync(filePath, "utf-8");
    expect(src).toContain("pending");
  });

  it("uses evidence fingerprint for dedup", () => {
    const src = readFileSync(filePath, "utf-8");
    expect(src).toContain("isDuplicate");
    expect(src).toContain("evidence");
  });

  it("uses workspace sourceType for signals", () => {
    const src = readFileSync(filePath, "utf-8");
    expect(src).toContain('sourceType: "workspace"');
  });
});

// ---------------------------------------------------------------------------
// Phase 8: SidecarClient workspace-signals method
// ---------------------------------------------------------------------------
describe("SidecarClient — workspace signals", () => {
  it("has detectWorkspaceSignals method", () => {
    const src = readSrc("lib/sidecar/client.ts");
    expect(src).toContain("detectWorkspaceSignals");
  });

  it("posts to /workspace-signals/detect", () => {
    const src = readSrc("lib/sidecar/client.ts");
    expect(src).toContain("/workspace-signals/detect");
  });
});

// ---------------------------------------------------------------------------
// Phase 9: Sidecar route
// ---------------------------------------------------------------------------
describe("Sidecar workspace-signals route", () => {
  const routePath = resolve(
    __dirname,
    "../../packages/sidecar/src/server/routes/workspace-signals.ts",
  );

  it("file exists", () => {
    expect(existsSync(routePath)).toBe(true);
  });

  it("exports createWorkspaceSignalRoutes", () => {
    const src = readFileSync(routePath, "utf-8");
    expect(src).toMatch(/export function createWorkspaceSignalRoutes/);
  });

  it("handles POST /detect", () => {
    const src = readFileSync(routePath, "utf-8");
    expect(src).toContain('"/detect"');
    expect(src).toContain("app.post");
  });

  it("uses WorkspaceSignalDetector", () => {
    const src = readFileSync(routePath, "utf-8");
    expect(src).toContain("WorkspaceSignalDetector");
  });

  it("is registered in app.ts", () => {
    const appSrc = readFileSync(
      resolve(__dirname, "../../packages/sidecar/src/server/app.ts"),
      "utf-8",
    );
    expect(appSrc).toContain("createWorkspaceSignalRoutes");
    expect(appSrc).toContain("workspace-signals");
  });
});
