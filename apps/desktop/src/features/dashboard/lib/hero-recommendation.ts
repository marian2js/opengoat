import type { Opportunity } from "@/features/dashboard/data/opportunities";
import type { ActionCard } from "@/features/dashboard/data/actions";

export interface HeroRecommendation {
  actionTitle: string;
  specialistName: string;
  actionId: string;
}

/**
 * Picks the best first move by finding the first opportunity with a
 * relatedActionId, looking up that action, and resolving the specialist name.
 */
export function pickBestFirstMove(
  opportunities: Opportunity[],
  actions: ActionCard[],
  specialists: { id: string; name: string }[],
): HeroRecommendation | null {
  for (const opp of opportunities) {
    if (!opp.relatedActionId) continue;

    const action = actions.find((a) => a.id === opp.relatedActionId);
    if (!action) continue;

    const specialist = action.specialistId
      ? specialists.find((s) => s.id === action.specialistId)
      : undefined;

    return {
      actionTitle: action.title,
      specialistName: specialist?.name ?? "a specialist",
      actionId: action.id,
    };
  }

  return null;
}
