import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { TaskRecord } from "@opengoat/contracts";
import { sortTasksByStatus } from "@/features/board/lib/sort-tasks";

export interface UseTaskListResult {
  tasks: TaskRecord[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTaskList(
  agentId: string,
  client: SidecarClient,
): UseTaskListResult {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
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
      .listTasks({ limit: 100 })
      .then((result) => {
        if (cancelled) return;
        setTasks(sortTasksByStatus(result.tasks));
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
  }, [agentId, client, refreshKey]);

  return { tasks, isLoading, error, refresh };
}
