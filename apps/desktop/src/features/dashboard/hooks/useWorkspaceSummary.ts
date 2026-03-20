import { useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import {
  parseWorkspaceSummary,
  type CompanySummaryData,
} from "@/features/dashboard/lib/parse-workspace-summary";
import type { WorkspaceFiles } from "@/features/dashboard/data/opportunities";

export interface UseWorkspaceSummaryResult {
  data: CompanySummaryData | null;
  files: WorkspaceFiles | null;
  isLoading: boolean;
  error: string | null;
}

const WORKSPACE_FILES = ["PRODUCT.md", "MARKET.md", "GROWTH.md"] as const;

/**
 * Fetches PRODUCT.md, MARKET.md, and GROWTH.md from the sidecar,
 * parses them, and returns the 5-point company summary plus raw file content.
 */
export function useWorkspaceSummary(
  agentId: string,
  client: SidecarClient,
): UseWorkspaceSummaryResult {
  const [data, setData] = useState<CompanySummaryData | null>(null);
  const [files, setFiles] = useState<WorkspaceFiles | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all(
      WORKSPACE_FILES.map((filename) =>
        client
          .readWorkspaceFile(agentId, filename)
          .then((result) => (result.exists ? result.content : null))
          .catch(() => null),
      ),
    ).then(([productMd, marketMd, growthMd]) => {
      if (cancelled) return;

      const rawFiles: WorkspaceFiles = {
        productMd: productMd ?? null,
        marketMd: marketMd ?? null,
        growthMd: growthMd ?? null,
      };
      setFiles(rawFiles);

      if (!productMd && !marketMd && !growthMd) {
        setData(null);
        setIsLoading(false);
        return;
      }

      const summary = parseWorkspaceSummary(
        productMd ?? null,
        marketMd ?? null,
        growthMd ?? null,
      );
      setData(summary);
      setIsLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Failed to load workspace files");
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [agentId, client]);

  return { data, files, isLoading, error };
}
