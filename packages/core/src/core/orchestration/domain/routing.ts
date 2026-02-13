import type { AgentProviderBinding, ProviderExecutionResult } from "../../providers/types.js";
import type { SessionCompactionResult, SessionRunInfo } from "../../sessions/index.js";

export interface RoutingCandidate {
  agentId: string;
  agentName: string;
  score: number;
  matchedTerms: string[];
  reason: string;
}

export interface RoutingDecision {
  entryAgentId: string;
  targetAgentId: string;
  confidence: number;
  reason: string;
  rewrittenMessage: string;
  candidates: RoutingCandidate[];
}

export interface AgentRunTrace {
  schemaVersion: 2;
  runId: string;
  startedAt: string;
  completedAt: string;
  entryAgentId: string;
  userMessage: string;
  session?: SessionRunInfo & {
    preRunCompactionApplied: boolean;
    postRunCompactionApplied: boolean;
    postRunCompactionSummary?: string;
  };
  execution: AgentProviderBinding &
    ProviderExecutionResult & {
      durationMs: number;
    };
}

export type OrchestrationRunResult = ProviderExecutionResult &
  AgentProviderBinding & {
    entryAgentId: string;
    tracePath: string;
    session?: SessionRunInfo & {
      preRunCompactionApplied: boolean;
      postRunCompaction: SessionCompactionResult;
    };
  };
