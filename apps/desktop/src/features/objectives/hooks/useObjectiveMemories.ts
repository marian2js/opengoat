import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { MemoryRecord } from "@opengoat/contracts";
import {
  OBJECTIVE_MEMORY_CATEGORIES,
  OBJECTIVE_CATEGORY_DISPLAY_NAMES,
} from "@/features/objectives/lib/objective-memory-categories";

export interface ObjectiveMemoryCategoryGroup {
  category: string;
  displayName: string;
  entries: MemoryRecord[];
}

export interface UseObjectiveMemoriesResult {
  groupedEntries: ObjectiveMemoryCategoryGroup[];
  isLoading: boolean;
  isEmpty: boolean;
  refresh: () => void;
}

export function useObjectiveMemories(
  agentId: string,
  objectiveId: string,
  client: SidecarClient,
): UseObjectiveMemoriesResult {
  const [entries, setEntries] = useState<MemoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    client
      .listMemories({
        projectId: agentId,
        objectiveId,
        scope: "objective",
        activeOnly: true,
      })
      .then((result) => {
        if (cancelled) return;
        setEntries(result);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("useObjectiveMemories: failed to fetch memories:", err);
        setEntries([]);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, objectiveId, client, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Always include all 8 categories, even if empty
  const groupedEntries: ObjectiveMemoryCategoryGroup[] =
    OBJECTIVE_MEMORY_CATEGORIES.map((category) => ({
      category,
      displayName: OBJECTIVE_CATEGORY_DISPLAY_NAMES[category] ?? category,
      entries: entries.filter((e) => e.category === category),
    }));

  return { groupedEntries, isLoading, isEmpty: entries.length === 0, refresh };
}
