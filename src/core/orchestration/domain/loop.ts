export type OrchestrationCommunicationMode = "direct" | "artifacts" | "hybrid";

export interface OrchestrationAgentDescriptor {
  agentId: string;
  name: string;
  description: string;
  provider: string;
  canReceive: boolean;
  canDelegate: boolean;
}

export interface OrchestrationBaseAction {
  type:
    | "delegate_to_agent"
    | "read_workspace_file"
    | "write_workspace_file"
    | "install_skill"
    | "respond_user"
    | "finish";
  mode?: OrchestrationCommunicationMode;
  reason?: string;
}

export interface DelegateToAgentAction extends OrchestrationBaseAction {
  type: "delegate_to_agent";
  targetAgentId: string;
  message: string;
  expectedOutput?: string;
}

export interface ReadWorkspaceFileAction extends OrchestrationBaseAction {
  type: "read_workspace_file";
  path: string;
}

export interface WriteWorkspaceFileAction extends OrchestrationBaseAction {
  type: "write_workspace_file";
  path: string;
  content: string;
}

export interface InstallSkillAction extends OrchestrationBaseAction {
  type: "install_skill";
  skillName: string;
  targetAgentId?: string;
  sourcePath?: string;
  description?: string;
  content?: string;
}

export interface RespondUserAction extends OrchestrationBaseAction {
  type: "respond_user";
  message: string;
}

export interface FinishAction extends OrchestrationBaseAction {
  type: "finish";
  message: string;
}

export type OrchestrationAction =
  | DelegateToAgentAction
  | ReadWorkspaceFileAction
  | WriteWorkspaceFileAction
  | InstallSkillAction
  | RespondUserAction
  | FinishAction;

export interface OrchestrationPlannerDecision {
  rationale: string;
  action: OrchestrationAction;
}

export interface OrchestrationStepLog {
  step: number;
  timestamp: string;
  plannerRawOutput: string;
  plannerDecision: OrchestrationPlannerDecision;
  agentCall?: {
    targetAgentId: string;
    request: string;
    response: string;
    code: number;
    providerId: string;
    sessionKey?: string;
    sessionId?: string;
  };
  artifactIO?: {
    readPath?: string;
    writePath?: string;
  };
  note?: string;
}

export interface OrchestrationRunLedger {
  schemaVersion: 2;
  runId: string;
  startedAt: string;
  completedAt: string;
  entryAgentId: string;
  userMessage: string;
  finalMessage: string;
  steps: OrchestrationStepLog[];
  sessionGraph: {
    nodes: Array<{
      agentId: string;
      sessionKey?: string;
      sessionId?: string;
    }>;
    edges: Array<{
      fromAgentId: string;
      toAgentId: string;
      reason?: string;
    }>;
  };
}
