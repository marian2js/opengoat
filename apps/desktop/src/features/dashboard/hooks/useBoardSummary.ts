import { useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import { computeBoardCounts, type BoardCounts } from "@/features/dashboard/lib/compute-board-counts";

export interface UseBoardSummaryResult {
  counts: BoardCounts;
  isLoading: boolean;
  isEmpty: boolean;
}

const ZERO_COUNTS: BoardCounts = { open: 0, doing: 0, blocked: 0, pending: 0, done: 0, total: 0 };

export function useBoardSummary(
  agentId: string,
  client: SidecarClient,
): UseBoardSummaryResult {
  const [counts, setCounts] = useState<BoardCounts>(ZERO_COUNTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    client
      .listTasks({ limit: 100 })
      .then((page) => {
        if (cancelled) return;
        setCounts(computeBoardCounts(page.tasks));
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("useBoardSummary: failed to fetch tasks:", err);
        setCounts(ZERO_COUNTS);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [agentId, client]);

  return { counts, isLoading, isEmpty: counts.total === 0 };
}
