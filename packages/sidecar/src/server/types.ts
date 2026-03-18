export interface CreateAgentRequest {
  id?: string;
  name: string;
  description?: string;
  instructions?: string;
  providerId?: string;
  modelId?: string;
  workspaceDir?: string;
  setAsDefault?: boolean;
}

export interface UpdateAgentRequest {
  description?: string;
  instructions?: string;
  modelId?: string;
  name?: string;
  providerId?: string;
  setAsDefault?: boolean;
  workspaceDir?: string;
}
