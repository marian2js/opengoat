import { useEffect, useState } from "react";
import type { SpecialistAgent } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";

export interface UseSpecialistRosterResult {
  specialists: SpecialistAgent[];
  isLoading: boolean;
}

export function useSpecialistRoster(client: SidecarClient): UseSpecialistRosterResult {
  const [specialists, setSpecialists] = useState<SpecialistAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    client
      .specialists()
      .then((roster) => {
        if (cancelled) return;
        setSpecialists(roster.specialists);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("useSpecialistRoster: failed to fetch specialists:", err);
        setSpecialists([]);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [client]);

  return { specialists, isLoading };
}

/** Look up specialist display name by ID. Returns undefined if not found. */
export function getSpecialistName(
  specialists: SpecialistAgent[],
  specialistId: string | undefined,
): string | undefined {
  if (!specialistId) return undefined;
  return specialists.find((s) => s.id === specialistId)?.name;
}
