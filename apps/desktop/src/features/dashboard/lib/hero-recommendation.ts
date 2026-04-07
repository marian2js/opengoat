import type { Opportunity } from "@/features/dashboard/data/opportunities";
import type { ActionCard } from "@/features/dashboard/data/actions";

export interface HeroRecommendation {
  actionTitle: string;
  specialistName: string;
  actionId: string;
}

/**
 * Picks the best first move using tier metadata first, falling back to
 * opportunity-based matching for backward compatibility.
 *
 * Priority: hero-tier action > primary-tier action > opportunity match > first action.
 */
export function pickBestFirstMove(
  opportunities: Opportunity[],
  actions: ActionCard[],
  specialists: { id: string; name: string }[],
): HeroRecommendation | null {
  if (actions.length === 0) return null;

  function resolve(action: ActionCard): HeroRecommendation {
    const specialist = action.specialistId
      ? specialists.find((s) => s.id === action.specialistId)
      : undefined;
    return {
      actionTitle: action.title,
      specialistName: specialist?.name ?? "a specialist",
      actionId: action.id,
    };
  }

  // Tier-based: prefer hero, then primary
  const heroAction = actions.find((a) => a.tier === "hero");
  if (heroAction) return resolve(heroAction);

  const primaryAction = actions.find((a) => a.tier === "primary");
  if (primaryAction) return resolve(primaryAction);

  // Fallback: opportunity-based matching (legacy)
  for (const opp of opportunities) {
    if (!opp.relatedActionId) continue;
    const action = actions.find((a) => a.id === opp.relatedActionId);
    if (action) return resolve(action);
  }

  // Last resort: first action
  return resolve(actions[0]);
}
