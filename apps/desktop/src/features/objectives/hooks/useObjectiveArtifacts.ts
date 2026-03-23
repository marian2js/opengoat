import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { ArtifactRecord } from "@opengoat/contracts";

export interface ArtifactGroup {
  status: string;
  label: string;
  artifacts: ArtifactRecord[];
}

export interface UseObjectiveArtifactsResult {
  groups: ArtifactGroup[];
  allArtifacts: ArtifactRecord[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Status display order — ready_for_review first as per spec */
const STATUS_ORDER: Record<string, number> = {
  ready_for_review: 0,
  draft: 1,
  needs_changes: 2,
  approved: 3,
  archived: 4,
};

const STATUS_LABELS: Record<string, string> = {
  ready_for_review: "Ready for Review",
  draft: "Draft",
  needs_changes: "Needs Changes",
  approved: "Approved",
  archived: "Archived",
};

function groupArtifactsByStatus(artifacts: ArtifactRecord[]): ArtifactGroup[] {
  const byStatus = new Map<string, ArtifactRecord[]>();
  for (const artifact of artifacts) {
    const existing = byStatus.get(artifact.status) ?? [];
    existing.push(artifact);
    byStatus.set(artifact.status, existing);
  }

  return Array.from(byStatus.entries())
    .map(([status, items]) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      artifacts: items,
    }))
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
}

export function useObjectiveArtifacts(
  objectiveId: string,
  client: SidecarClient,
): UseObjectiveArtifactsResult {
  const [allArtifacts, setAllArtifacts] = useState<ArtifactRecord[]>([]);
  const [groups, setGroups] = useState<ArtifactGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    client.listArtifacts({ objectiveId })
      .then((result) => {
        if (cancelled) return;
        const items = result.items;
        setAllArtifacts(items);
        setGroups(groupArtifactsByStatus(items));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [objectiveId, client, refreshKey]);

  return { groups, allArtifacts, isLoading, error, refresh };
}
