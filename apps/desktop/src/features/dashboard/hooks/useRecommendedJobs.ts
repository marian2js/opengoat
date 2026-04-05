import { useMemo } from "react";
import type { SpecialistAgent } from "@opengoat/contracts";
import type { ActionCard } from "@/features/dashboard/data/actions";
import { starterActions } from "@/features/dashboard/data/actions";
import { getSpecialistName } from "@/features/dashboard/hooks/useSpecialistRoster";
import { getSpecialistColors, type SpecialistColorConfig } from "@/features/agents/specialist-meta";

export interface RecommendedJob extends ActionCard {
  specialistName: string | undefined;
  specialistColors: SpecialistColorConfig;
}

export interface UseRecommendedJobsResult {
  jobs: RecommendedJob[];
  isLoading: boolean;
}

/**
 * Merges suggested (company-specific) and starter actions into a curated
 * list of 3–5 recommended jobs. Suggested actions take priority; remaining
 * slots are filled from starterActions. De-duplicates by id.
 */
export function useRecommendedJobs(
  suggestedActions: ActionCard[],
  isSuggestedLoading: boolean,
  specialists: SpecialistAgent[],
): UseRecommendedJobsResult {
  const jobs = useMemo(() => {
    const seen = new Set<string>();
    const merged: RecommendedJob[] = [];

    // Prefer suggested actions first (company-specific)
    for (const action of suggestedActions) {
      if (seen.has(action.id)) continue;
      seen.add(action.id);
      merged.push({
        ...action,
        specialistName: getSpecialistName(specialists, action.specialistId),
        specialistColors: getSpecialistColors(action.specialistId ?? ""),
      });
    }

    // Fill remaining slots from starter actions
    for (const action of starterActions) {
      if (seen.has(action.id)) continue;
      seen.add(action.id);
      merged.push({
        ...action,
        specialistName: getSpecialistName(specialists, action.specialistId),
        specialistColors: getSpecialistColors(action.specialistId ?? ""),
      });
    }

    return merged.slice(0, 5);
  }, [suggestedActions, specialists]);

  return { jobs, isLoading: isSuggestedLoading && suggestedActions.length === 0 };
}
