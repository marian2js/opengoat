import { useMemo } from "react";
import type { SpecialistAgent } from "@opengoat/contracts";
import type { ActionCard } from "@/features/dashboard/data/actions";
import { starterActions } from "@/features/dashboard/data/actions";
import { getSpecialistName } from "@/features/dashboard/hooks/useSpecialistRoster";
import { getSpecialistColors, type SpecialistColorConfig } from "@/features/agents/specialist-meta";
import { groupAndRankJobs, type TieredJobs } from "@/features/dashboard/lib/tier-scoring";

export type { JobTier } from "@/features/dashboard/lib/tier-scoring";

export interface RecommendedJob extends ActionCard {
  specialistName: string | undefined;
  specialistColors: SpecialistColorConfig;
  tier: "hero" | "primary" | "secondary";
}

export interface UseRecommendedJobsResult {
  hero: RecommendedJob | null;
  primary: RecommendedJob[];
  secondary: RecommendedJob[];
  isLoading: boolean;
}

/**
 * Merges suggested (company-specific) and starter actions, then groups
 * them into hero / primary / secondary tiers. Suggested actions take
 * priority; remaining slots are filled from starterActions. De-duplicates by id.
 */
export function useRecommendedJobs(
  suggestedActions: ActionCard[],
  isSuggestedLoading: boolean,
  specialists: SpecialistAgent[],
): UseRecommendedJobsResult {
  const tiered = useMemo(() => {
    const seen = new Set<string>();
    const merged: RecommendedJob[] = [];

    // Prefer suggested actions first (company-specific)
    for (const action of suggestedActions) {
      if (seen.has(action.id)) continue;
      seen.add(action.id);
      merged.push({
        ...action,
        tier: action.tier ?? "secondary",
        specialistName: getSpecialistName(specialists, action.specialistId),
        specialistColors: getSpecialistColors(action.specialistId ?? ""),
      });
    }

    // Fill from starter actions
    for (const action of starterActions) {
      if (seen.has(action.id)) continue;
      seen.add(action.id);
      merged.push({
        ...action,
        tier: action.tier ?? "secondary",
        specialistName: getSpecialistName(specialists, action.specialistId),
        specialistColors: getSpecialistColors(action.specialistId ?? ""),
      });
    }

    return groupAndRankJobs(merged);
  }, [suggestedActions, specialists]);

  return {
    hero: tiered.hero,
    primary: tiered.primary,
    secondary: tiered.secondary,
    isLoading: isSuggestedLoading && suggestedActions.length === 0,
  };
}
