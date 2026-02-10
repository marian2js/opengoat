import type { AgentProviderBinding, ProviderExecutionResult } from "../../providers/types.js";
import type { SessionCompactionResult, SessionRunInfo } from "../../sessions/index.js";

export interface ManagerRuntimeStep {
  step: number;
  note: string;
}

export interface ManagerRuntimeSessionGraph {
  nodes: Array<{
    agentId: string;
    providerId?: string;
    sessionKey?: string;
    sessionId?: string;
    providerSessionId?: string;
  }>;
  edges: Array<{
    fromAgentId: string;
    toAgentId: string;
    reason?: string;
  }>;
}

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
    mode: "single-agent";
    steps: ManagerRuntimeStep[];
    finalMessage: string;
    sessionGraph: ManagerRuntimeSessionGraph;
  };
}

export type OrchestrationRunResult = ProviderExecutionResult &
  AgentProviderBinding & {
    entryAgentId: string;
    routing: RoutingDecision;
  tracePath: string;
  orchestration?: {
      mode: "single-agent";
      steps: ManagerRuntimeStep[];
      finalMessage: string;
      sessionGraph: ManagerRuntimeSessionGraph;
    };
    session?: SessionRunInfo & {
      preRunCompactionApplied: boolean;
      postRunCompaction: SessionCompactionResult;
    };
  };
