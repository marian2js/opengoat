import { useEffect, useState, useMemo } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { ObjectiveMapEntry } from "@/features/board/lib/board-grouping";

export interface UseObjectiveMapResult {
  objectiveMap: Map<string, ObjectiveMapEntry>;
  isLoading: boolean;
}

/**
 * Fetches all objectives and returns a lookup Map<objectiveId, { title, status }>.
 * Gracefully returns empty map if the backend isn't available.
 */
export function useObjectiveMap(
  agentId: string,
  client: SidecarClient,
): UseObjectiveMapResult {
  const [objectives, setObjectives] = useState<
    Array<{ objectiveId: string; title: string; status: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await client.listObjectives(agentId);
        if (cancelled) return;

        const items = Array.isArray(result)
          ? result
          : Array.isArray((result as Record<string, unknown>)?.items)
            ? ((result as Record<string, unknown>).items as typeof objectives)
            : [];

        setObjectives(
          items.map((o: { objectiveId: string; title: string; status?: string }) => ({
            objectiveId: o.objectiveId,
            title: o.title,
            status: (o as Record<string, unknown>).status as string ?? "draft",
          })),
        );
      } catch {
        if (cancelled) return;
        setObjectives([]);
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [agentId, client]);

  const objectiveMap = useMemo(() => {
    const map = new Map<string, ObjectiveMapEntry>();
    for (const obj of objectives) {
      map.set(obj.objectiveId, { title: obj.title, status: obj.status });
    }
    return map;
  }, [objectives]);

  return { objectiveMap, isLoading };
}
