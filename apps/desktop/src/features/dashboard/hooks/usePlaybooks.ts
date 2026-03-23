import { useEffect, useState } from "react";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { PlaybookManifest } from "@opengoat/contracts";

export interface UsePlaybooksResult {
  playbooks: PlaybookManifest[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches the playbook library from the sidecar.
 *
 * Returns an empty list gracefully when the backend hasn't been deployed yet
 * (API returns 404) so the dashboard can render without the playbook section.
 */
export function usePlaybooks(client: SidecarClient): UsePlaybooksResult {
  const [playbooks, setPlaybooks] = useState<PlaybookManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load(): Promise<void> {
      try {
        const result = await client.listPlaybooks();
        if (!cancelled) {
          setPlaybooks(result.playbooks);
        }
      } catch {
        if (!cancelled) {
          // Graceful fallback — backend may not have the route yet
          setPlaybooks([]);
          setError(null);
        }
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [client]);

  return { playbooks, isLoading, error };
}
