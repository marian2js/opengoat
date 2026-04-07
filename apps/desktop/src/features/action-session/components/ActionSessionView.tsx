import { Chat, useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangleIcon, LoaderCircleIcon } from "lucide-react";
import type { ChatBootstrap } from "@/app/types";
import {
  chatDataPartSchemas,
  getTextParts,
  type ChatUIMessage,
} from "@/features/chat/message-parts";
import { createChatTransport } from "@/features/chat/transport";
import { chatCache } from "@/features/chat/components/ChatWorkspace";
import type { SidecarClient } from "@/lib/sidecar/client";
import {
  deriveActionSessionState,
  extractOutputs,
  getActionSessionMeta,
  setActionSessionMeta,
  markSessionSavedToBoard,
  updateActionSessionState,
  updateActionSessionLatestOutput,
} from "../lib/action-session-state";
import type { ActionSessionState } from "../types";
import { ActionSessionHeader } from "./ActionSessionHeader";
import { ActionSessionProgress } from "./ActionSessionProgress";
import { ActionSessionOutputs } from "./ActionSessionOutputs";
import { ActionSessionInput } from "./ActionSessionInput";
import { SaveToBoardControls } from "./SaveToBoardControls";
import { ActionSessionFooter } from "./ActionSessionFooter";
import {
  clearPersistedActionContext,
  readPersistedActionContext,
  readActionOutputPromise,
} from "../lib/action-session-persistence";
import { useAutoArtifacts } from "@/features/chat/hooks/useAutoArtifacts";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActionSessionViewProps {
  agentId?: string | undefined;
  client: SidecarClient | null;
  pendingActionPrompt?: string | null | undefined;
  sessionId?: string | undefined;
  actionTitle?: string | undefined;
  onPendingPromptConsumed?: (() => void) | undefined;
  onViewChat: (sessionId: string) => void;
  onBackToDashboard: () => void;
}

// ---------------------------------------------------------------------------
// Outer component — loads bootstrap data
// ---------------------------------------------------------------------------

export function ActionSessionView({
  agentId,
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

  // Recover action context from sessionStorage if props are missing
  // (happens after HMR or page reload while on #action-session).
  const recovered = useMemo(() => {
    if (pendingActionPrompt && sessionId) return null; // props are fine
    return readPersistedActionContext();
  }, [pendingActionPrompt, sessionId]);

  const effectiveSessionId = sessionId ?? recovered?.sessionId;
  const effectivePrompt = pendingActionPrompt ?? recovered?.prompt ?? null;
  const effectiveTitle = actionTitle ?? recovered?.title ?? "Action";

  // Read output promise data from sessionStorage (persisted by useIntakeForm)
  const outputPromise = useMemo(() => readActionOutputPromise(), []);

  // If there's absolutely no session ID (no props AND nothing persisted),
  // redirect to dashboard — we can't render an action session without one.
  useEffect(() => {
    if (!isLoading) return; // only check on initial mount
    if (!effectiveSessionId && !client) {
      // Still loading client — wait
      return;
    }
    if (!effectiveSessionId && client) {
      onBackToDashboard();
    }
  }, [effectiveSessionId, client, isLoading, onBackToDashboard]);

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

      if (!effectiveSessionId) {
        if (!cancelled) {
          setBootstrap(null);
          setErrorMessage("No session found. Please start a new action from the dashboard.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const nextBootstrap = await client.chatBootstrap(agentId, effectiveSessionId);
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
  }, [agentId, client, effectiveSessionId]);

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
      pendingActionPrompt={effectivePrompt}
      actionTitle={effectiveTitle}
      actionPromise={outputPromise?.promise}
      actionOutputType={outputPromise?.outputType}
      onPendingPromptConsumed={() => {
        clearPersistedActionContext();
        onPendingPromptConsumed?.();
      }}
      onViewChat={onViewChat}
      onBackToDashboard={onBackToDashboard}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner component — manages Chat instance and auto-send
// ---------------------------------------------------------------------------

/** How long (ms) before showing "stuck" UI in the starting state. */
const STUCK_THRESHOLD_MS = 45_000;

function ActionSessionInner({
  agentId,
  bootstrap,
  client,
  pendingActionPrompt,
  actionTitle,
  actionPromise,
  actionOutputType,
  onPendingPromptConsumed,
  onViewChat,
  onBackToDashboard,
}: {
  agentId?: string | undefined;
  bootstrap: ChatBootstrap;
  client: SidecarClient | null;
  pendingActionPrompt?: string | null | undefined;
  actionTitle: string;
  actionPromise?: string | undefined;
  actionOutputType?: string | undefined;
  onPendingPromptConsumed?: (() => void) | undefined;
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
  const [sendError, setSendError] = useState<string | null>(null);
  const [isStuck, setIsStuck] = useState(false);

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

  const { clearError, error: chatError, messages, sendMessage, status } = useChat<ChatUIMessage>({ chat });

  // Auto-persist outputs as artifacts for the RECENT OUTPUTS dashboard section
  useAutoArtifacts({
    messages,
    status,
    client,
    agentId,
    specialistId: bootstrap.session.specialistId,
    sessionId: bootstrap.session.id,
    minContentLength: 80, // Action sessions always produce intentional outputs
  });

  // Surface errors from the useChat hook (e.g., transport/streaming failures)
  useEffect(() => {
    if (chatError && !sendError) {
      console.error("[ActionSession] useChat error:", chatError);
      setSendError(chatError.message || "An unexpected error occurred.");
    }
  }, [chatError, sendError]);

  // Auto-send hidden prompt for action card execution
  useEffect(() => {
    if (!pendingActionPrompt || pendingPromptSentRef.current) {
      return;
    }
    pendingPromptSentRef.current = true;

    // Use async wrapper so we can catch transport errors
    (async () => {
      try {
        await sendMessage({ text: pendingActionPrompt });
      } catch (error) {
        console.error("[ActionSession] sendMessage failed:", error);
        setSendError(
          error instanceof Error ? error.message : "Failed to send message to the AI agent.",
        );
      }
    })();

    onPendingPromptConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingActionPrompt]);

  // Stuck detection: if we stay in "starting" state for too long, surface it.
  useEffect(() => {
    const hasAssistantContent = messages.some(
      (m) => m.role === "assistant" && m.parts.some((p) => p.type === "text" && p.text),
    );
    if (hasAssistantContent || sendError) {
      setIsStuck(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsStuck(true);
    }, STUCK_THRESHOLD_MS);

    return () => clearTimeout(timer);
  }, [messages, sendError]);

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

  // Persist latest output preview for dashboard display
  useEffect(() => {
    if (outputs.length > 0) {
      const latest = outputs[outputs.length - 1]!;
      const preview = latest.content.slice(0, 200);
      updateActionSessionLatestOutput(bootstrap.session.id, preview);
    }
  }, [outputs, bootstrap.session.id]);

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

  // Manual retry: re-send the prompt
  const handleRetrySend = useCallback(async () => {
    if (!pendingActionPrompt) return;
    setSendError(null);
    setIsStuck(false);
    // Clear the chat-level error so status returns to "ready"
    clearError();
    try {
      await sendMessage({ text: pendingActionPrompt });
    } catch (error) {
      console.error("[ActionSession] retry sendMessage failed:", error);
      setSendError(
        error instanceof Error ? error.message : "Failed to send message. Please try again.",
      );
    }
  }, [clearError, pendingActionPrompt, sendMessage]);

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
          outputCount={outputs.length}
          actionPromise={actionPromise}
          actionOutputType={actionOutputType}
        />

        {/* Error banner when sendMessage fails */}
        {sendError && (
          <div className="mx-5 flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <AlertTriangleIcon className="size-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Failed to start action</p>
              <p className="mt-0.5 text-xs text-destructive/70">{sendError}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleRetrySend()}
              className="shrink-0 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stuck banner when session stays at "starting" too long */}
        {isStuck && !sendError && sessionState === "starting" && (
          <div className="mx-5 flex items-center gap-3 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
            <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Taking longer than expected</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The action hasn't started yet. You can retry or go back to the dashboard.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {pendingActionPrompt && (
                <button
                  type="button"
                  onClick={() => void handleRetrySend()}
                  className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                >
                  Retry
                </button>
              )}
              <button
                type="button"
                onClick={onBackToDashboard}
                className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Dashboard
              </button>
            </div>
          </div>
        )}

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
