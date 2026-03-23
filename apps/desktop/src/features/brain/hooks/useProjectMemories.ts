import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { MemoryRecord } from "@opengoat/contracts";

export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  brand_voice: "Brand Voice",
  product_facts: "Product Facts",
  icp_facts: "ICP Facts",
  competitors: "Competitors",
  channels_tried: "Channels Tried",
  channels_to_avoid: "Channels to Avoid",
  founder_preferences: "Founder Preferences",
  approval_preferences: "Approval Preferences",
  messaging_constraints: "Messaging Constraints",
  legal_compliance: "Legal & Compliance",
  team_process: "Team & Process",
};

export const CATEGORY_ORDER: string[] = [
  "brand_voice",
  "product_facts",
  "icp_facts",
  "competitors",
  "channels_tried",
  "channels_to_avoid",
  "founder_preferences",
  "approval_preferences",
  "messaging_constraints",
  "legal_compliance",
  "team_process",
];

export interface CategoryGroup {
  category: string;
  displayName: string;
  entries: MemoryRecord[];
}

export interface UseProjectMemoriesResult {
  groupedEntries: CategoryGroup[];
  isLoading: boolean;
  isEmpty: boolean;
  refresh: () => void;
}

export function useProjectMemories(
  agentId: string,
  client: SidecarClient,
): UseProjectMemoriesResult {
  const [entries, setEntries] = useState<MemoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    client
      .listMemories({ projectId: agentId, scope: "project", activeOnly: true })
      .then((result) => {
        if (cancelled) return;
        setEntries(result);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("useProjectMemories: failed to fetch memories:", err);
        setEntries([]);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, client, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const groupedEntries: CategoryGroup[] = CATEGORY_ORDER
    .map((category) => ({
      category,
      displayName: CATEGORY_DISPLAY_NAMES[category] ?? category,
      entries: entries.filter((e) => e.category === category),
    }))
    .filter((g) => g.entries.length > 0);

  return { groupedEntries, isLoading, isEmpty: entries.length === 0, refresh };
}
