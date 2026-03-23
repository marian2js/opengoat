import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { Signal } from "@opengoat/contracts";

export interface UseSignalsFilters {
  projectId?: string;
  objectiveId?: string;
  status?: string;
  sourceType?: string;
  limit?: number;
  offset?: number;
}

export interface UseSignalsResult {
  signals: Signal[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSignals(
  client: SidecarClient,
  filters?: UseSignalsFilters,
): UseSignalsResult {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [total, setTotal] = useState(0);
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

    client
      .listSignals({
        projectId: filters?.projectId,
        objectiveId: filters?.objectiveId,
        status: filters?.status,
        sourceType: filters?.sourceType,
        limit: filters?.limit ?? 50,
        offset: filters?.offset,
      })
      .then((result) => {
        if (cancelled) return;
        setSignals(result.items);
        setTotal(result.total);
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
  }, [
    client,
    filters?.projectId,
    filters?.objectiveId,
    filters?.status,
    filters?.sourceType,
    filters?.limit,
    filters?.offset,
    refreshKey,
  ]);

  return { signals, total, isLoading, error, refresh };
}
