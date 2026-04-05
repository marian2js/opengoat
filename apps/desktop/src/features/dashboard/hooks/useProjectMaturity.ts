import type { UseMeaningfulWorkResult } from "@/features/dashboard/hooks/useMeaningfulWork";
import type { UseRunsResult } from "@/features/dashboard/hooks/useRuns";
import type { UseBoardSummaryResult } from "@/features/dashboard/hooks/useBoardSummary";
import type { UseActionSessionsResult } from "@/features/dashboard/hooks/useActionSessions";

export type ProjectMaturity = "new" | "light" | "active";

export interface MaturitySignals {
  hasMeaningfulWork: boolean;
  runsEmpty: boolean;
  boardEmpty: boolean;
  hasRecentSessions: boolean;
}

/**
 * Pure function to compute project maturity tier from data signals.
 *
 * - 'active': user-owned meaningful work exists (fresh runs/sessions)
 * - 'new': no work at all — no runs, no board tasks, no recent sessions
 * - 'light': some history exists but no active meaningful work
 */
export function computeMaturity(signals: MaturitySignals): ProjectMaturity {
  if (signals.hasMeaningfulWork) {
    return "active";
  }
  if (signals.runsEmpty && signals.boardEmpty && !signals.hasRecentSessions) {
    return "new";
  }
  return "light";
}

/**
 * Hook that computes project maturity tier from existing dashboard hook results.
 * Controls section visibility in the unified dashboard layout.
 */
export function useProjectMaturity(
  meaningfulWork: UseMeaningfulWorkResult,
  runsResult: UseRunsResult,
  boardSummary: UseBoardSummaryResult,
  actionSessions: UseActionSessionsResult,
): ProjectMaturity {
  const maturity = computeMaturity({
    hasMeaningfulWork: meaningfulWork.hasMeaningfulWork,
    runsEmpty: runsResult.isEmpty,
    boardEmpty: boardSummary.isEmpty,
    hasRecentSessions: actionSessions.recentSessions.length > 0,
  });
  return maturity;
}
