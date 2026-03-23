import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { Objective } from "@/features/dashboard/types/objective";

export interface UseActiveObjectiveResult {
  objective: Objective | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches the primary active objective for the current project.
 *
 * Calls `client.listObjectives(projectId, "active")` on mount
 * and returns the first active objective. Re-fetches when agentId changes.
 *
 * Returns null objective gracefully when the backend hasn't been deployed yet
 * (API returns 404) or when no active objectives exist.
 */
export function useActiveObjective(
  agentId: string,
  client: SidecarClient,
): UseActiveObjectiveResult {
  const [objective, setObjective] = useState<Objective | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => {
    setFetchKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load(): Promise<void> {
      try {
        const result = await client.listObjectives(agentId, "active");

        if (cancelled) return;

        // The API returns an array of objectives (or an object with items)
        const items = Array.isArray(result)
          ? (result as Objective[])
          : Array.isArray((result as Record<string, unknown>)?.items)
            ? ((result as Record<string, unknown>).items as Objective[])
            : [];

        // First active objective is the primary
        const first: Objective | null = items.length > 0 ? (items[0] ?? null) : null;
        setObjective(first);
      } catch {
        if (cancelled) return;
        // Graceful fallback — backend may not exist yet (404)
        setObjective(null);
        setError(null); // Don't show error to user for expected 404
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [agentId, client, fetchKey]);

  return { objective, isLoading, error, refetch };
}
