import { Chat, useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import type { AuthOverview, ChatBootstrap } from "@/app/types";
import {
  chatDataPartSchemas,
  getTextParts,
  type ChatUIMessage,
} from "@/features/chat/message-parts";
import { createChatTransport } from "@/features/chat/transport";
import { chatCache, isActionSession } from "@/features/chat/components/ChatWorkspace";
import type { SidecarClient } from "@/lib/sidecar/client";
import {
  deriveActionSessionState,
  extractOutputs,
  getActionSessionMeta,
  setActionSessionMeta,
  markSessionSavedToBoard,
  updateActionSessionState,
} from "../lib/action-session-state";
import type { ActionSessionState } from "../types";
import { ActionSessionHeader } from "./ActionSessionHeader";
import { ActionSessionProgress } from "./ActionSessionProgress";
import { ActionSessionOutputs } from "./ActionSessionOutputs";
import { ActionSessionInput } from "./ActionSessionInput";
import { SaveToBoardControls } from "./SaveToBoardControls";
import { ActionSessionFooter } from "./ActionSessionFooter";

interface ActionSessionViewProps {
  agentId?: string;
  authOverview: AuthOverview | null;
  client: SidecarClient | null;
  pendingActionPrompt?: string | null;
  sessionId?: string;
  actionTitle?: string;
  onPendingPromptConsumed?: () => void;
  onViewChat: (sessionId: string) => void;
  onBackToDashboard: () => void;
}

export function ActionSessionView({
  agentId,
  authOverview,
  client,
  pendingActionPrompt,
  sessionId,
  actionTitle,
  onPendingPromptConsumed,
  onViewChat,
  onBackToDashboard,
}: ActionSessionViewProps) {
  const [bootstrap, setBootstrap] = useState<ChatBootstrap | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadChat(): Promise<void> {
      if (!client) {
        if (!cancelled) {
          setBootstrap(null);
          setErrorMessage("Action session is unavailable right now.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const nextBootstrap = await client.chatBootstrap(agentId, sessionId);
        if (!cancelled) {
          setBootstrap(nextBootstrap);
        }
      } catch (error) {
        console.error("Failed to bootstrap action session", error);
        if (!cancelled) {
          setBootstrap(null);
          setErrorMessage(
            error instanceof Error ? error.message : "Action session is unavailable.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadChat();

    return () => {
      cancelled = true;
    };
  }, [agentId, client, sessionId]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2.5">
          <LoaderCircleIcon className="size-5 animate-spin text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Loading action session</p>
        </div>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className="flex flex-1 flex-col items-start gap-3 px-4 py-6 lg:px-6">
        <div className="rounded-lg border border-warning/20 bg-warning/8 px-3.5 py-2.5 text-sm text-warning-foreground">
          {errorMessage ?? "Action session is unavailable right now."}
        </div>
        <button
          type="button"
          onClick={onBackToDashboard}
          className="rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <ActionSessionInner
      key={bootstrap.session.id}
      agentId={agentId}
      bootstrap={bootstrap}
      client={client}
      pendingActionPrompt={pendingActionPrompt}
      actionTitle={actionTitle ?? bootstrap.session.label ?? "Action"}
      onPendingPromptConsumed={onPendingPromptConsumed}
      onViewChat={onViewChat}
      onBackToDashboard={onBackToDashboard}
    />
  );
}

function ActionSessionInner({
  agentId,
  bootstrap,
  client,
  pendingActionPrompt,
  actionTitle,
  onPendingPromptConsumed,
  onViewChat,
  onBackToDashboard,
}: {
  agentId?: string;
  bootstrap: ChatBootstrap;
  client: SidecarClient | null;
  pendingActionPrompt?: string | null;
  actionTitle: string;
  onPendingPromptConsumed?: () => void;
  onViewChat: (sessionId: string) => void;
  onBackToDashboard: () => void;
}) {
  const pendingPromptSentRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didMountRef = useRef(false);

  const [savedToBoard, setSavedToBoard] = useState(() => {
    const meta = getActionSessionMeta(bootstrap.session.id);
    return meta?.savedToBoard ?? false;
  });

  const [isDone, setIsDone] = useState(false);

  // Initialize session meta on mount
  useEffect(() => {
    const existing = getActionSessionMeta(bootstrap.session.id);
    if (!existing) {
      setActionSessionMeta(bootstrap.session.id, {
        actionId: "",
        actionTitle,
        state: "starting",
        savedToBoard: false,
        startedAt: Date.now(),
      });
    }
  }, [bootstrap.session.id, actionTitle]);

  const startedAt = useMemo(() => {
    const meta = getActionSessionMeta(bootstrap.session.id);
    return meta?.startedAt ?? Date.now();
  }, [bootstrap.session.id]);

  // Re-use existing Chat instance from chatCache
  const chat = useMemo(() => {
    const existing = chatCache.get(bootstrap.session.id);
    if (existing) {
      return existing;
    }
    const transport = createChatTransport({
      agentId: bootstrap.agent.id,
      client,
      sessionId: bootstrap.session.id,
    });
    const instance = new Chat<ChatUIMessage>({
      dataPartSchemas: chatDataPartSchemas,
      id: bootstrap.session.id,
      messages: bootstrap.messages.map(toUiMessage),
      transport,
    });
    chatCache.set(bootstrap.session.id, instance);
    return instance;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap.session.id]);

  const { messages, sendMessage, status } = useChat<ChatUIMessage>({ chat });

  // Auto-send hidden prompt for action card execution
  useEffect(() => {
    if (!pendingActionPrompt || pendingPromptSentRef.current) {
      return;
    }
    pendingPromptSentRef.current = true;
    void sendMessage({ text: pendingActionPrompt });
    onPendingPromptConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingActionPrompt]);

  // Auto-scroll as outputs arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      behavior: didMountRef.current ? "smooth" : "instant",
      top: el.scrollHeight,
    });
    didMountRef.current = true;
  }, [messages, status]);

  // Derive action session state
  const sessionState: ActionSessionState = useMemo(() => {
    if (isDone) return "done";
    return deriveActionSessionState(status, messages, savedToBoard);
  }, [status, messages, savedToBoard, isDone]);

  // Persist state changes
  useEffect(() => {
    updateActionSessionState(bootstrap.session.id, sessionState);
  }, [bootstrap.session.id, sessionState]);

  // Extract outputs from assistant messages
  const outputs = useMemo(() => extractOutputs(messages), [messages]);

  // Extract question for needs-input state
  const pendingQuestion = useMemo(() => {
    if (sessionState !== "needs-input") return "";
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    if (assistantMessages.length === 0) return "";
    const lastAssistant = assistantMessages[assistantMessages.length - 1]!;
    const textParts = getTextParts(lastAssistant);
    return textParts[textParts.length - 1] ?? "";
  }, [sessionState, messages]);

  const handleInputSubmit = useCallback(
    (text: string) => {
      void sendMessage({ text });
    },
    [sendMessage],
  );

  const handleSaved = useCallback(() => {
    setSavedToBoard(true);
    markSessionSavedToBoard(bootstrap.session.id);
  }, [bootstrap.session.id]);

  const handleSkip = useCallback(() => {
    setIsDone(true);
    updateActionSessionState(bootstrap.session.id, "done");
  }, [bootstrap.session.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ActionSessionHeader
        actionTitle={actionTitle}
        state={sessionState}
        startedAt={startedAt}
      />

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
      >
        <ActionSessionProgress
          state={sessionState}
          hasOutputs={outputs.length > 0}
        />

        <ActionSessionOutputs outputs={outputs} />

        {sessionState === "needs-input" && (
          <ActionSessionInput
            question={pendingQuestion}
            onSubmit={handleInputSubmit}
          />
        )}

        {sessionState === "ready-to-review" && client && agentId && (
          <SaveToBoardControls
            outputs={outputs}
            client={client}
            agentId={agentId}
            sessionId={bootstrap.session.id}
            actionTitle={actionTitle}
            onSaved={handleSaved}
            onSkip={handleSkip}
          />
        )}

        {sessionState === "saved-to-board" && (
          <div className="mx-5 flex items-center gap-2 rounded-lg bg-primary/5 px-4 py-3">
            <span className="text-sm font-medium text-primary">
              Saved to Board
            </span>
            <a
              href="#board"
              className="text-xs font-medium text-primary/70 underline underline-offset-2 hover:text-primary"
            >
              Open Board
            </a>
          </div>
        )}
      </div>

      <ActionSessionFooter
        onViewChat={() => onViewChat(bootstrap.session.id)}
        onBackToDashboard={onBackToDashboard}
        onNewAction={onBackToDashboard}
      />
    </div>
  );
}

function toUiMessage(message: ChatBootstrap["messages"][number]): ChatUIMessage {
  return {
    id: message.id,
    metadata: {
      createdAt: message.createdAt,
    },
    parts: message.text
      ? [{ text: message.text, type: "text" as const }]
      : [],
    role: message.role,
  };
}
