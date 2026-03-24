import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { ArtifactRecord } from "@opengoat/contracts";

export interface UseArtifactResult {
  artifact: ArtifactRecord | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useArtifact(
  artifactId: string | null,
  client: SidecarClient,
): UseArtifactResult {
  const [artifact, setArtifact] = useState<ArtifactRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!artifactId) {
      setArtifact(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    client
      .getArtifact(artifactId)
      .then((result) => {
        if (cancelled) return;
        setArtifact(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setArtifact(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [artifactId, client, refreshKey]);

  return { artifact, isLoading, error, refresh };
}
