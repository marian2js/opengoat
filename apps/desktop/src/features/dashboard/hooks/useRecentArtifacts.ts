import { useCallback, useEffect, useState } from "react";
import type { ArtifactRecord } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";

export interface BundleGroup {
  bundleId: string;
  title: string;
  artifacts: ArtifactRecord[];
}

export interface UseRecentArtifactsResult {
  standaloneArtifacts: ArtifactRecord[];
  bundleGroups: BundleGroup[];
  isLoading: boolean;
  isEmpty: boolean;
}

const MAX_VISIBLE = 4;

/** Polling interval for live updates (15 seconds) */
const POLL_INTERVAL_MS = 15_000;

export function useRecentArtifacts(
  agentId: string,
  client: SidecarClient,
): UseRecentArtifactsResult {
  const [standaloneArtifacts, setStandaloneArtifacts] = useState<ArtifactRecord[]>([]);
  const [bundleGroups, setBundleGroups] = useState<BundleGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchArtifacts = useCallback(
    (setLoading: boolean) => {
      let cancelled = false;
      if (setLoading) setIsLoading(true);

      client
        .listArtifacts({ projectId: agentId, limit: 20 })
        .then((page) => {
          if (cancelled) return;
          const { standalone, groups } = processArtifacts(page.items);
          setStandaloneArtifacts(standalone);
          setBundleGroups(groups);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          console.error("useRecentArtifacts: failed to fetch artifacts:", err);
          setStandaloneArtifacts([]);
          setBundleGroups([]);
          setIsLoading(false);
        });

      return () => { cancelled = true; };
    },
    [agentId, client],
  );

  // Initial fetch and refetch on dependency change
  useEffect(() => {
    return fetchArtifacts(true);
  }, [fetchArtifacts, refreshKey]);

  // Poll for live updates
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchArtifacts(false);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollInterval);
  }, [fetchArtifacts]);

  // Refetch on window focus and hashchange (navigation back to dashboard)
  useEffect(() => {
    const onRefresh = () => setRefreshKey((k) => k + 1);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("hashchange", onRefresh);
    return () => {
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("hashchange", onRefresh);
    };
  }, []);

  return {
    standaloneArtifacts,
    bundleGroups,
    isLoading,
    isEmpty: standaloneArtifacts.length === 0 && bundleGroups.length === 0,
  };
}

function processArtifacts(items: ArtifactRecord[]): {
  standalone: ArtifactRecord[];
  groups: BundleGroup[];
} {
  const standaloneList: ArtifactRecord[] = [];
  const bundleMap = new Map<string, ArtifactRecord[]>();

  for (const artifact of items) {
    if (artifact.bundleId) {
      const existing = bundleMap.get(artifact.bundleId) ?? [];
      existing.push(artifact);
      bundleMap.set(artifact.bundleId, existing);
    } else {
      standaloneList.push(artifact);
    }
  }

  // Deduplicate standalone artifacts by type + createdBy (keep most recent)
  const deduped = new Map<string, ArtifactRecord>();
  for (const artifact of standaloneList) {
    const key = `${artifact.type}::${artifact.createdBy ?? "unknown"}`;
    const existing = deduped.get(key);
    if (!existing || new Date(artifact.createdAt) > new Date(existing.createdAt)) {
      deduped.set(key, artifact);
    }
  }
  const dedupedStandalone = Array.from(deduped.values());

  // Build bundle groups sorted by most recent artifact
  const groups: BundleGroup[] = Array.from(bundleMap.entries()).map(
    ([id, artifacts]) => ({
      bundleId: id,
      title: deriveBundleTitle(artifacts),
      artifacts: artifacts.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    }),
  );

  groups.sort(
    (a, b) =>
      new Date(b.artifacts[0]!.createdAt).getTime() -
      new Date(a.artifacts[0]!.createdAt).getTime(),
  );

  // Trim total visible items (bundles count as 1)
  let visibleCount = 0;
  const trimmedGroups: BundleGroup[] = [];
  const trimmedStandalone: ArtifactRecord[] = [];

  type Entry =
    | { kind: "bundle"; group: BundleGroup; ts: number }
    | { kind: "standalone"; artifact: ArtifactRecord; ts: number };

  const entries: Entry[] = [
    ...groups.map((g) => ({
      kind: "bundle" as const,
      group: g,
      ts: new Date(g.artifacts[0]!.createdAt).getTime(),
    })),
    ...dedupedStandalone.map((a) => ({
      kind: "standalone" as const,
      artifact: a,
      ts: new Date(a.createdAt).getTime(),
    })),
  ];

  entries.sort((a, b) => b.ts - a.ts);

  for (const entry of entries) {
    if (visibleCount >= MAX_VISIBLE) break;
    if (entry.kind === "bundle") {
      trimmedGroups.push(entry.group);
    } else {
      trimmedStandalone.push(entry.artifact);
    }
    visibleCount++;
  }

  return { standalone: trimmedStandalone, groups: trimmedGroups };
}

/** Derive a bundle title from the artifacts — uses common type prefix or first artifact title. */
function deriveBundleTitle(artifacts: ArtifactRecord[]): string {
  if (artifacts.length === 0) return "Bundle";
  // If there's a common type, use it as the bundle title
  const types = new Set(artifacts.map((a) => a.type));
  if (types.size === 1) {
    const type = artifacts[0]!.type;
    return formatTypeName(type) + " Bundle";
  }
  return artifacts[0]!.title.split(" — ")[0] ?? "Bundle";
}

function formatTypeName(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
