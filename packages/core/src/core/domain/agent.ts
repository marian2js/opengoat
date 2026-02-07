export interface AgentIdentity {
  id: string;
  displayName: string;
}

export interface AgentDescriptor extends AgentIdentity {
  workspaceDir: string;
  internalConfigDir: string;
}

export interface AgentCreationResult {
  agent: AgentDescriptor;
  createdPaths: string[];
  skippedPaths: string[];
}
