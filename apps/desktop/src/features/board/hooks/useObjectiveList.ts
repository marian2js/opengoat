import { useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";

export interface ObjectiveOption {
  objectiveId: string;
  title: string;
}

export interface UseObjectiveListResult {
  objectives: ObjectiveOption[];
  isLoading: boolean;
}

/**
 * Fetches all objectives for populating the board objective filter dropdown.
 * Gracefully returns empty list if the backend isn't available.
 */
export function useObjectiveList(
  agentId: string,
  client: SidecarClient,
): UseObjectiveListResult {
  const [objectives, setObjectives] = useState<ObjectiveOption[]>([]);
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
            ? ((result as Record<string, unknown>).items as ObjectiveOption[])
            : [];

        setObjectives(
          items.map((o: { objectiveId: string; title: string }) => ({
            objectiveId: o.objectiveId,
            title: o.title,
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

  return { objectives, isLoading };
}
