import { useCallback, useState } from "react";
import {
  type ChatScope,
  clearChatScope,
  getChatScope,
  writeChatScope,
} from "@/features/chat/lib/chat-scope";

export interface UseChatScopeResult {
  scope: ChatScope;
  setScope: (scope: ChatScope) => void;
  clearScope: () => void;
}

/**
 * Hook that manages chat scope for a given session.
 * Reads initial scope from localStorage on mount and persists changes.
 */
export function useChatScope(sessionId: string | undefined): UseChatScopeResult {
  const [scope, setScopeState] = useState<ChatScope>(() => {
    if (!sessionId) return { type: "unattached" };
    return getChatScope(sessionId);
  });

  const setScope = useCallback(
    (next: ChatScope) => {
      setScopeState(next);
      if (sessionId) {
        writeChatScope(sessionId, next);
      }
    },
    [sessionId],
  );

  const clearScopeHandler = useCallback(() => {
    setScopeState({ type: "unattached" });
    if (sessionId) {
      clearChatScope(sessionId);
    }
  }, [sessionId]);

  return { scope, setScope, clearScope: clearScopeHandler };
}
