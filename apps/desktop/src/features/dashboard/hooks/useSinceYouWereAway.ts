import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import {
  type FeedItem,
  mapSignalToFeedItem,
  mapBlockedTaskToFeedItem,
  mapPendingTaskToFeedItem,
  mergeFeedItems,
} from "@/features/dashboard/lib/feed-item-types";
import { getLastVisited, setLastVisited } from "@/features/dashboard/lib/last-visited";

export interface UseSinceYouWereAwayResult {
  items: FeedItem[];
  isLoading: boolean;
  isEmpty: boolean;
  refresh: () => void;
}

export function useSinceYouWereAway(
  client: SidecarClient,
  agentId: string,
  projectId: string,
): UseSinceYouWereAwayResult {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const lastVisited = getLastVisited(agentId);

    // Trigger workspace signal detection (fire-and-forget)
    client.detectWorkspaceSignals(projectId).catch(() => {
      // Detection failure should not block feed loading
    });

    // Fetch signals and tasks in parallel
    Promise.all([
      client.listSignals({ projectId, status: "new", limit: 20 }),
      client.listTasks({ status: "blocked", limit: 20 }),
      client.listTasks({ status: "pending", limit: 20 }),
    ])
      .then(([signalsPage, blockedPage, pendingPage]) => {
        if (cancelled) return;

        const feedItems: FeedItem[] = [
          ...signalsPage.items.map(mapSignalToFeedItem),
          ...blockedPage.tasks.map(mapBlockedTaskToFeedItem),
          ...pendingPage.tasks.map(mapPendingTaskToFeedItem),
        ];

        // Filter by last visited timestamp
        const filtered = lastVisited
          ? feedItems.filter((item) => item.timestamp > lastVisited)
          : feedItems;

        setItems(mergeFeedItems(filtered));
        setIsLoading(false);

        // Update last visited timestamp
        setLastVisited(agentId);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("useSinceYouWereAway: failed to fetch feed:", err);
        setItems([]);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, agentId, projectId, refreshKey]);

  return { items, isLoading, isEmpty: items.length === 0, refresh };
}
