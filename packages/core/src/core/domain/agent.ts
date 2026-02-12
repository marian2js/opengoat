export interface AgentIdentity {
  id: string;
  displayName: string;
  role?: string;
}

export interface AgentDescriptor extends AgentIdentity {
  role: string;
  workspaceDir: string;
  internalConfigDir: string;
}

export interface AgentCreationResult {
  agent: AgentDescriptor;
  alreadyExisted?: boolean;
  createdPaths: string[];
  skippedPaths: string[];
  runtimeSync?: {
    runtimeId: string;
    code: number;
    stdout: string;
    stderr: string;
  };
}

export interface CreateAgentOptions {
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
  role?: string;
}

export interface AgentManagerUpdateResult {
  agentId: string;
  previousReportsTo: string | null;
  reportsTo: string | null;
  updatedPaths: string[];
}

export interface AgentReporteeSummary {
  id: string;
  name: string;
  role: string;
  totalReportees: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  totalReportees: number;
  directReportees: AgentReporteeSummary[];
}

export interface AgentDeletionResult {
  agentId: string;
  existed: boolean;
  removedPaths: string[];
  skippedPaths: string[];
  runtimeSync?: {
    runtimeId: string;
    code: number;
    stdout: string;
    stderr: string;
  };
}

export interface DeleteAgentOptions {
  force?: boolean;
}
