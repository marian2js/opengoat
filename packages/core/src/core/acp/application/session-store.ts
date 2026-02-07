import type { AcpPromptRunState, AcpSessionState, AcpSessionStore } from "../domain/session.js";

export class InMemoryAcpSessionStore implements AcpSessionStore {
  private readonly sessions = new Map<string, AcpSessionState>();
  private readonly activeRuns = new Map<string, AcpPromptRunState>();

  public put(session: AcpSessionState): void {
    this.sessions.set(session.sessionId, { ...session });
  }

  public get(sessionId: string): AcpSessionState | undefined {
    const found = this.sessions.get(sessionId);
    return found ? { ...found } : undefined;
  }

  public update(sessionId: string, update: Partial<AcpSessionState>): AcpSessionState | undefined {
    const current = this.sessions.get(sessionId);
    if (!current) {
      return undefined;
    }

    const next = { ...current, ...update };
    this.sessions.set(sessionId, next);
    return { ...next };
  }

  public list(): AcpSessionState[] {
    return [...this.sessions.values()]
      .map((entry) => ({ ...entry }))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  public setActiveRun(sessionId: string, run: AcpPromptRunState): void {
    this.activeRuns.set(sessionId, { ...run });
  }

  public getActiveRun(sessionId: string): AcpPromptRunState | undefined {
    const found = this.activeRuns.get(sessionId);
    return found ? { ...found } : undefined;
  }

  public clearActiveRun(sessionId: string): void {
    this.activeRuns.delete(sessionId);
  }

  public clear(): void {
    this.activeRuns.clear();
    this.sessions.clear();
  }
}
