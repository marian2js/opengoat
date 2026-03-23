import { useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type {
  TaskRecord,
  Objective,
  RunRecord,
  ArtifactRecord,
  Signal,
} from "@opengoat/contracts";

export interface LinkedEntities {
  objective: Objective | null;
  run: RunRecord | null;
  artifacts: ArtifactRecord[];
  signals: Signal[];
  isLoading: boolean;
}

const EMPTY: LinkedEntities = {
  objective: null,
  run: null,
  artifacts: [],
  signals: [],
  isLoading: false,
};

/**
 * Pure async fetcher — exported for unit testing without React.
 */
export async function fetchLinkedEntities(
  task: TaskRecord,
  client: SidecarClient,
): Promise<Omit<LinkedEntities, "isLoading">> {
  const objectiveId = task.objectiveId ?? (task.metadata?.objectiveId as string | undefined);
  const runId = task.runId ?? (task.metadata?.runId as string | undefined);

  const promises = {
    objective: objectiveId
      ? client.getObjective(objectiveId).catch(() => null)
      : Promise.resolve(null),
    run: runId
      ? client.getRun(runId).catch(() => null)
      : Promise.resolve(null),
    artifacts: objectiveId || runId
      ? client
          .listArtifacts({ taskId: task.taskId })
          .then((page) => page.items)
          .catch(() => [] as ArtifactRecord[])
      : Promise.resolve([] as ArtifactRecord[]),
    signals: objectiveId
      ? client
          .listSignals({ objectiveId })
          .then((page) => page.items)
          .catch(() => [] as Signal[])
      : Promise.resolve([] as Signal[]),
  };

  const [objective, run, artifacts, signals] = await Promise.all([
    promises.objective,
    promises.run,
    promises.artifacts,
    promises.signals,
  ]);

  return { objective, run, artifacts, signals };
}

/**
 * React hook that resolves linked entities for a task.
 */
export function useLinkedEntities(
  task: TaskRecord | null,
  client: SidecarClient,
): LinkedEntities {
  const [state, setState] = useState<LinkedEntities>(EMPTY);

  useEffect(() => {
    if (!task) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true }));

    fetchLinkedEntities(task, client)
      .then((result) => {
        if (!cancelled) {
          setState({ ...result, isLoading: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(EMPTY);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [task?.taskId, task?.objectiveId, task?.runId, client]);

  return state;
}
