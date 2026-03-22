import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { TaskRecord } from "@opengoat/contracts";

export interface UseTaskDetailResult {
  task: TaskRecord | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTaskDetail(
  taskId: string | null,
  client: SidecarClient,
): UseTaskDetailResult {
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    client
      .getTask(taskId)
      .then((result) => {
        if (cancelled) return;
        setTask(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setTask(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, client, refreshKey]);

  return { task, isLoading, error, refresh };
}
