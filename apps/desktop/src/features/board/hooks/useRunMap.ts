import { useEffect, useState, useMemo } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { RunMapEntry } from "@/features/board/lib/board-grouping";

export interface UseRunMapResult {
  runMap: Map<string, RunMapEntry>;
  isLoading: boolean;
}

/**
 * Fetches all runs and returns a lookup Map<runId, { title, playbookId?, playbookTitle? }>.
 * Gracefully returns empty map if the backend isn't available.
 */
export function useRunMap(
  agentId: string,
  client: SidecarClient,
): UseRunMapResult {
  const [runs, setRuns] = useState<
    Array<{ runId: string; title: string; playbookId?: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await client.listRuns({ limit: 200 });
        if (cancelled) return;

        const items = Array.isArray(result)
          ? result
          : Array.isArray((result as Record<string, unknown>)?.runs)
            ? ((result as Record<string, unknown>).runs as typeof runs)
            : [];

        setRuns(
          items.map((r: { runId: string; title: string; playbookId?: string }) => ({
            runId: r.runId,
            title: r.title,
            playbookId: r.playbookId,
          })),
        );
      } catch {
        if (cancelled) return;
        setRuns([]);
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [agentId, client]);

  const runMap = useMemo(() => {
    const map = new Map<string, RunMapEntry>();
    for (const run of runs) {
      map.set(run.runId, {
        title: run.title,
        playbookId: run.playbookId,
        // playbookTitle requires a separate lookup; for MVP, leave undefined
        playbookTitle: undefined,
      });
    }
    return map;
  }, [runs]);

  return { runMap, isLoading };
}
