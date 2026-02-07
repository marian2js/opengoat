import type { AgentProviderBinding, ProviderExecutionResult } from "../../providers/types.js";
import type { SessionCompactionResult, SessionRunInfo } from "../../sessions/index.js";
import type { OrchestrationRunLedger, OrchestrationStepLog } from "./loop.js";

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
  routing: RoutingDecision;
  session?: SessionRunInfo & {
    preRunCompactionApplied: boolean;
    postRunCompactionApplied: boolean;
    postRunCompactionSummary?: string;
  };
  execution: AgentProviderBinding &
    ProviderExecutionResult & {
      durationMs: number;
    };
  orchestration?: {
    mode: "ai-loop" | "single-agent";
    steps: OrchestrationStepLog[];
    finalMessage: string;
    sessionGraph: OrchestrationRunLedger["sessionGraph"];
  };
}

export type OrchestrationRunResult = ProviderExecutionResult &
  AgentProviderBinding & {
    entryAgentId: string;
    routing: RoutingDecision;
    tracePath: string;
    orchestration?: {
      mode: "ai-loop" | "single-agent";
      steps: OrchestrationStepLog[];
      finalMessage: string;
      sessionGraph: OrchestrationRunLedger["sessionGraph"];
    };
    session?: SessionRunInfo & {
      preRunCompactionApplied: boolean;
      postRunCompaction: SessionCompactionResult;
    };
  };
