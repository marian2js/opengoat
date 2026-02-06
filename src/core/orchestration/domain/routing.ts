import type { AgentProviderBinding, ProviderExecutionResult } from "../../providers/types.js";

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
  schemaVersion: 1;
  runId: string;
  startedAt: string;
  completedAt: string;
  entryAgentId: string;
  userMessage: string;
  routing: RoutingDecision;
  execution: AgentProviderBinding &
    ProviderExecutionResult & {
      durationMs: number;
    };
}

export type OrchestrationRunResult = ProviderExecutionResult &
  AgentProviderBinding & {
    entryAgentId: string;
    routing: RoutingDecision;
    tracePath: string;
  };
