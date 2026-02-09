import type { ProviderInvokeOptions } from "../../providers/index.js";

export type OrchestrationRunStage =
  | "run_started"
  | "planner_started"
  | "planner_decision"
  | "delegation_started"
  | "provider_invocation_started"
  | "provider_invocation_completed"
  | "run_completed";

export interface OrchestrationRunEvent {
  stage: OrchestrationRunStage;
  timestamp: string;
  runId: string;
  step?: number;
  agentId?: string;
  targetAgentId?: string;
  providerId?: string;
  actionType?: string;
  mode?: string;
  code?: number;
  detail?: string;
}

export interface OrchestrationRunHooks {
  onEvent?: (event: OrchestrationRunEvent) => void;
}

export type OrchestrationRunOptions = ProviderInvokeOptions & {
  hooks?: OrchestrationRunHooks;
};
