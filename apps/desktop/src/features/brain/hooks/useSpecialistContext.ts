import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { MemoryRecord } from "@opengoat/contracts";

export interface SpecialistGroup {
  specialistId: string;
  entries: MemoryRecord[];
}

export interface UseSpecialistContextResult {
  groupedBySpecialist: SpecialistGroup[];
  isLoading: boolean;
  isEmpty: boolean;
  refresh: () => void;
}

export function useSpecialistContext(
  agentId: string,
  client: SidecarClient,
): UseSpecialistContextResult {
  const [entries, setEntries] = useState<MemoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    client
      .listMemories({
        projectId: agentId,
        category: "specialist_context",
        scope: "project",
        activeOnly: true,
      })
      .then((result) => {
        if (cancelled) return;
        setEntries(result);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("useSpecialistContext: failed to fetch memories:", err);
        setEntries([]);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, client, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Group entries by specialistId
  const groupedBySpecialist: SpecialistGroup[] = [];
  const groupMap = new Map<string, MemoryRecord[]>();

  for (const entry of entries) {
    const sid = entry.specialistId ?? "unknown";
    const group = groupMap.get(sid);
    if (group) {
      group.push(entry);
    } else {
      groupMap.set(sid, [entry]);
    }
  }

  for (const [specialistId, groupEntries] of groupMap) {
    groupedBySpecialist.push({ specialistId, entries: groupEntries });
  }

  return { groupedBySpecialist, isLoading, isEmpty: entries.length === 0, refresh };
}
