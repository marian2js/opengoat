/**
 * Chat scope types and localStorage persistence helpers.
 *
 * Each chat session can be scoped to unattached, project, objective, or run.
 * Scopes are stored in localStorage keyed by session ID, following the same
 * pattern used for action session tracking.
 */

export type ChatScope =
  | { type: "unattached" }
  | { type: "project" }
  | { type: "objective"; objectiveId: string }
  | { type: "run"; objectiveId: string; runId: string };

export type ChatScopeMap = Record<string, ChatScope>;

const STORAGE_KEY = "opengoat:chatScopes";

export function readChatScopes(): ChatScopeMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as ChatScopeMap;
    }
    return {};
  } catch {
    return {};
  }
}

export function writeChatScope(sessionId: string, scope: ChatScope): void {
  try {
    const map = readChatScopes();
    map[sessionId] = scope;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export function clearChatScope(sessionId: string): void {
  try {
    const map = readChatScopes();
    delete map[sessionId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export function getChatScope(sessionId: string): ChatScope {
  const map = readChatScopes();
  return map[sessionId] ?? { type: "unattached" };
}

export function getScopeLabel(scope: ChatScope): string {
  switch (scope.type) {
    case "unattached":
      return "Unattached";
    case "project":
      return "Project";
    case "objective":
      return "Objective";
    case "run":
      return "Run";
  }
}
