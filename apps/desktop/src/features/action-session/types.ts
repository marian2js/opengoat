export type ActionSessionState =
  | "starting"
  | "working"
  | "needs-input"
  | "ready-to-review"
  | "saved-to-board"
  | "done";

export interface ActionSessionInfo {
  sessionId: string;
  actionId: string;
  actionTitle: string;
  state: ActionSessionState;
  startedAt: number;
  firstOutputAt?: number;
  savedToBoard: boolean;
}

export interface ActionSessionMeta {
  actionId: string;
  actionTitle: string;
  state: ActionSessionState;
  savedToBoard: boolean;
  startedAt: number;
  latestOutput?: string;
}

export interface OutputBlock {
  id: string;
  title: string;
  content: string;
  messageId: string;
}
