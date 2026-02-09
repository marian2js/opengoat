export type ProviderKind = "cli" | "http";

export interface ProviderCapabilities {
  agent: boolean;
  model: boolean;
  auth: boolean;
  passthrough: boolean;
  agentCreate?: boolean;
  agentDelete?: boolean;
}

export interface ProviderInvokeOptions {
  message: string;
  systemPrompt?: string;
  skillsPromptOverride?: string;
  runId?: string;
  orchestrationStep?: number;
  sessionRef?: string;
  forceNewSession?: boolean;
  disableSession?: boolean;
  directAgentSession?: boolean;
  providerSessionId?: string;
  forceNewProviderSession?: boolean;
  sessionContext?: string;
  agent?: string;
  model?: string;
  passthroughArgs?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onRunStatus?: (event: ProviderRunStatusEvent) => void;
}

export interface ProviderRunStatusEvent {
  type:
    | "run_started"
    | "planner_started"
    | "planner_decision"
    | "delegation_started"
    | "provider_invocation_started"
    | "provider_invocation_completed"
    | "run_completed";
  runId?: string;
  timestamp?: string;
  step?: number;
  agentId?: string;
  targetAgentId?: string;
  providerId?: string;
  actionType?: string;
  mode?: string;
  code?: number;
  detail?: string;
}

export interface ProviderAuthOptions {
  passthroughArgs?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface ProviderCreateAgentOptions {
  agentId: string;
  displayName: string;
  workspaceDir: string;
  internalConfigDir: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface ProviderDeleteAgentOptions {
  agentId: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface ProviderExecutionResult {
  code: number;
  stdout: string;
  stderr: string;
  providerSessionId?: string;
}

export interface ProviderInvocation {
  command: string;
  args: string[];
}

export interface Provider {
  readonly id: string;
  readonly displayName: string;
  readonly kind: ProviderKind;
  readonly capabilities: ProviderCapabilities;

  invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult>;
  invokeAuth?(options?: ProviderAuthOptions): Promise<ProviderExecutionResult>;
  createAgent?(options: ProviderCreateAgentOptions): Promise<ProviderExecutionResult>;
  deleteAgent?(options: ProviderDeleteAgentOptions): Promise<ProviderExecutionResult>;
}

export interface ProviderSummary {
  id: string;
  displayName: string;
  kind: ProviderKind;
  capabilities: ProviderCapabilities;
}

export interface AgentProviderBinding {
  agentId: string;
  providerId: string;
}
