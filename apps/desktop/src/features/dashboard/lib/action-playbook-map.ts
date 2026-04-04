import type { ActionCard } from "@/features/dashboard/data/actions";

/**
 * Returns the playbookId for an action card, if one is mapped.
 * Actions without a playbookId use the existing generic chat flow.
 */
export function getPlaybookForAction(card: ActionCard): string | undefined {
  return card.playbookId;
}

/**
 * Returns true if the action should use the playbook launch flow
 * (i.e., it has a playbookId and creates tracked work).
 */
export function isPlaybookAction(card: ActionCard): boolean {
  return Boolean(card.playbookId);
}
