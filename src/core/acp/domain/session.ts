export interface AcpSessionState {
  sessionId: string;
  agentId: string;
  sessionRef: string;
  cwd: string;
  createdAt: number;
  updatedAt: number;
}

export interface AcpPromptRunState {
  runId: string;
  sessionId: string;
  cancelled: boolean;
}

export interface AcpSessionStore {
  put(session: AcpSessionState): void;
  get(sessionId: string): AcpSessionState | undefined;
  update(sessionId: string, update: Partial<AcpSessionState>): AcpSessionState | undefined;
  list(): AcpSessionState[];
  setActiveRun(sessionId: string, run: AcpPromptRunState): void;
  getActiveRun(sessionId: string): AcpPromptRunState | undefined;
  clearActiveRun(sessionId: string): void;
  clear(): void;
}
