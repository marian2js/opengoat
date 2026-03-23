import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { Objective } from "@/features/dashboard/types/objective";

export interface UseObjectiveDetailResult {
  objective: Objective | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useObjectiveDetail(
  objectiveId: string,
  client: SidecarClient,
): UseObjectiveDetailResult {
  const [objective, setObjective] = useState<Objective | null>(null);
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

    client.getObjective(objectiveId)
      .then((result) => {
        if (cancelled) return;
        setObjective(result as Objective);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setObjective(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [objectiveId, client, refreshKey]);

  return { objective, isLoading, error, refresh };
}
