import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { RunRecord } from "@opengoat/contracts";

export interface UseObjectiveRunsResult {
  runs: RunRecord[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useObjectiveRuns(
  objectiveId: string,
  client: SidecarClient,
): UseObjectiveRunsResult {
  const [runs, setRuns] = useState<RunRecord[]>([]);
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

    client.listRuns({ objectiveId })
      .then((result) => {
        if (cancelled) return;
        setRuns(result.runs);
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

  return { runs, isLoading, error, refresh };
}
