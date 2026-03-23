import { useEffect, useState } from "react";
import type { RunRecord } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";

export interface UseRunsResult {
  runs: RunRecord[];
  isLoading: boolean;
  isEmpty: boolean;
}

const ACTIVE_STATUSES = "running,waiting_review,blocked,draft";

export function useRuns(
  agentId: string,
  client: SidecarClient,
): UseRunsResult {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    client
      .listRuns({ projectId: agentId, status: ACTIVE_STATUSES })
      .then((page) => {
        if (cancelled) return;
        setRuns(page.runs);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("useRuns: failed to fetch runs:", err);
        setRuns([]);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [agentId, client]);

  return { runs, isLoading, isEmpty: runs.length === 0 };
}
