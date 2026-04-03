import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { TaskRecord } from "@opengoat/contracts";

export interface UseLeadingTaskResult {
  leadingTask: TaskRecord | null;
  isLoading: boolean;
  setLeadingTask: (taskId: string) => Promise<void>;
  clearLeadingTask: () => Promise<void>;
  refresh: () => void;
}

export function useLeadingTask(
  client: SidecarClient,
): UseLeadingTaskResult {
  const [leadingTask, setLeadingTaskState] = useState<TaskRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    client
      .getLeadingTask()
      .then((task) => {
        if (cancelled) return;
        setLeadingTaskState(task);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("useLeadingTask: failed to fetch:", err);
        setLeadingTaskState(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, refreshKey]);

  const setLeadingTask = useCallback(
    async (taskId: string) => {
      const task = await client.setLeadingTask(taskId);
      setLeadingTaskState(task);
    },
    [client],
  );

  const clearLeadingTask = useCallback(async () => {
    await client.clearLeadingTask();
    setLeadingTaskState(null);
  }, [client]);

  return { leadingTask, isLoading, setLeadingTask, clearLeadingTask, refresh };
}
