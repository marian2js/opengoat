import { useCallback, useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { ArtifactVersion } from "@opengoat/contracts";

export interface UseArtifactVersionsResult {
  versions: ArtifactVersion[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useArtifactVersions(
  artifactId: string | null,
  client: SidecarClient,
): UseArtifactVersionsResult {
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!artifactId) {
      setVersions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    client
      .getArtifactVersions(artifactId)
      .then((result) => {
        if (cancelled) return;
        setVersions(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setVersions([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [artifactId, client, refreshKey]);

  return { versions, isLoading, error, refresh };
}
