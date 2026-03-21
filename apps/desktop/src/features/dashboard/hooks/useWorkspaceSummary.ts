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

interface FileResult {
  content: string | null;
  error: string | null;
}

function fetchFile(client: SidecarClient, agentId: string, filename: string): Promise<FileResult> {
  return client.readWorkspaceFile(agentId, filename).then(
    (result) => ({ content: result.exists ? result.content : null, error: null }),
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`useWorkspaceSummary: failed to fetch ${filename}:`, message);
      return { content: null, error: message };
    },
  );
}

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
      WORKSPACE_FILES.map((filename) => fetchFile(client, agentId, filename)),
    ).then((results) => {
      if (cancelled) return;

      const productResult = results[0]!;
      const marketResult = results[1]!;
      const growthResult = results[2]!;

      const productMd = productResult.content;
      const marketMd = marketResult.content;
      const growthMd = growthResult.content;

      const rawFiles: WorkspaceFiles = {
        productMd: productMd ?? null,
        marketMd: marketMd ?? null,
        growthMd: growthMd ?? null,
      };
      setFiles(rawFiles);

      // If all files failed to load, report the first error
      const fileErrors = [productResult, marketResult, growthResult]
        .map((r: FileResult) => r.error)
        .filter(Boolean);

      if (!productMd && !marketMd && !growthMd) {
        if (fileErrors.length > 0) {
          setError(`Failed to load workspace files: ${fileErrors[0]}`);
        }
        setData(null);
        setIsLoading(false);
        return;
      }

      try {
        const summary = parseWorkspaceSummary(
          productMd ?? null,
          marketMd ?? null,
          growthMd ?? null,
        );
        setData(summary);
      } catch (parseErr: unknown) {
        console.error("parseWorkspaceSummary failed:", parseErr);
        setError(
          parseErr instanceof Error
            ? parseErr.message
            : "Failed to parse workspace summary",
        );
      }
      setIsLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      console.error("useWorkspaceSummary: unexpected error:", err);
      setError(err instanceof Error ? err.message : "Failed to load workspace files");
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [agentId, client]);

  return { data, files, isLoading, error };
}
