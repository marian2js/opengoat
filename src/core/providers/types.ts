export type ProviderKind = "cli" | "http";

export interface ProviderCapabilities {
  agent: boolean;
  model: boolean;
  auth: boolean;
  passthrough: boolean;
}

export interface ProviderInvokeOptions {
  message: string;
  systemPrompt?: string;
  agent?: string;
  model?: string;
  passthroughArgs?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface ProviderAuthOptions {
  passthroughArgs?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface ProviderExecutionResult {
  code: number;
  stdout: string;
  stderr: string;
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
