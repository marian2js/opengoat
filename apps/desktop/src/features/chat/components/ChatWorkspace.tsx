import { Chat, useChat } from "@ai-sdk/react";
import {
  BotIcon,
  CalendarIcon,
  CopyIcon,
  CrosshairIcon,
  FileTextIcon,
  LoaderCircleIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthOverview, ChatBootstrap } from "@/app/types";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Message,
  MessageActions,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@/components/ai-elements/message";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Button } from "@/components/ui/button";
import {
  chatDataPartSchemas,
  getActivityParts,
  getReasoningText,
  getTextParts,
  type ChatUIMessage,
} from "@/features/chat/message-parts";
import { createChatTransport } from "@/features/chat/transport";
import { SidecarClient } from "@/lib/sidecar/client";

/**
 * Cache of Chat instances keyed by session ID.
 * Keeps streaming state alive when the user switches between sessions.
 */
const chatCache = new Map<string, Chat<ChatUIMessage>>();

/** Remove a session from the chat cache (e.g. on delete). */
export function evictChatSession(sessionId: string): void {
  chatCache.delete(sessionId);
}

/**
 * Persistent tracking of action-initiated sessions.
 * Module-level Set survives React re-mounts within the same page load.
 * localStorage survives page refreshes.
 */
const ACTION_SESSIONS_KEY = "opengoat:actionSessions";
const actionSessionIds = new Set<string>();

// Hydrate from localStorage on module load
try {
  const stored = localStorage.getItem(ACTION_SESSIONS_KEY);
  if (stored) {
    const ids: unknown = JSON.parse(stored);
    if (Array.isArray(ids)) {
      for (const id of ids) {
        if (typeof id === "string") {
          actionSessionIds.add(id);
        }
      }
    }
  }
} catch {
  // Ignore corrupt localStorage
}

function persistActionSessions(): void {
  try {
    localStorage.setItem(
      ACTION_SESSIONS_KEY,
      JSON.stringify([...actionSessionIds]),
    );
  } catch {
    // Ignore storage errors
  }
}

/** Mark a session as action-initiated (call before any rendering). */
export function markActionSession(sessionId: string): void {
  actionSessionIds.add(sessionId);
  persistActionSessions();
}

/** Check if a session was initiated by an action card. */
export function isActionSession(sessionId: string): boolean {
  if (actionSessionIds.has(sessionId)) {
    return true;
  }
  // Cold-start fallback: check localStorage and hydrate
  try {
    const stored = localStorage.getItem(ACTION_SESSIONS_KEY);
    if (stored) {
      const ids: unknown = JSON.parse(stored);
      if (Array.isArray(ids) && ids.includes(sessionId)) {
        actionSessionIds.add(sessionId);
        return true;
      }
    }
  } catch {
    // Ignore
  }
  return false;
}

interface ChatWorkspaceProps {
  agentId?: string | undefined;
  authOverview: AuthOverview | null;
  client: SidecarClient | null;
  onBootstrap?: ((sessionId: string) => void) | undefined;
  onPendingPromptConsumed?: (() => void) | undefined;
  onSessionLabelUpdate?: ((sessionId: string, label: string) => void) | undefined;
  pendingActionPrompt?: string | null | undefined;
  sessionId?: string | undefined;
}

const STARTER_PROMPTS: { icon: LucideIcon; text: string }[] = [
  { icon: TrendingUpIcon, text: "What are the top 3 growth opportunities for my product right now?" },
  { icon: CalendarIcon, text: "Draft a content calendar for the next two weeks." },
  { icon: CrosshairIcon, text: "Analyze my competitors and find positioning gaps." },
];

export function ChatWorkspace({
  agentId,
  authOverview,
  client,
  onBootstrap,
  onPendingPromptConsumed,
  onSessionLabelUpdate,
  pendingActionPrompt,
  sessionId,
}: ChatWorkspaceProps) {
  const [bootstrap, setBootstrap] = useState<ChatBootstrap | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadChat(): Promise<void> {
      if (!client) {
        if (!cancelled) {
          setBootstrap(null);
          setErrorMessage("Chat is unavailable right now.");
          setIsLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setErrorMessage(null);
      }

      try {
        // When no session is selected, let bootstrapConversation pick the
        // latest existing session (or create the initial one if none exist).
        // New sessions are only created explicitly via the "+" button.
        const nextBootstrap = await client.chatBootstrap(agentId, sessionId);
        if (!cancelled) {
          setBootstrap(nextBootstrap);
          onBootstrap?.(nextBootstrap.session.id);
        }
      } catch (error) {
        console.error("Failed to bootstrap chat", error);
        if (!cancelled) {
          setBootstrap(null);
          setErrorMessage(
            error instanceof Error ? error.message : "Chat is unavailable right now.",
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, client, refreshToken, sessionId]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2.5">
          <LoaderCircleIcon className="size-5 animate-spin text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Loading chat</p>
        </div>
      </div>
    );
  }

  if (!bootstrap) {
    return (
      <div className="flex flex-1 flex-col items-start gap-3 px-4 py-6 lg:px-6">
        <div className="rounded-lg border border-warning/20 bg-warning/8 px-3.5 py-2.5 text-sm text-warning-foreground">
          {errorMessage ?? "Chat is unavailable right now."}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshToken((current) => current + 1);
            }}
          >
            Retry
          </Button>
          <Button asChild size="sm">
            <a href="#connections">Manage providers</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ChatSessionView
      key={bootstrap.session.id}
      authOverview={authOverview}
      bootstrap={bootstrap}
      client={client}
      onPendingPromptConsumed={onPendingPromptConsumed}
      onSessionLabelUpdate={onSessionLabelUpdate}
      pendingActionPrompt={pendingActionPrompt}
    />
  );
}

function deriveSessionLabel(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 50) {
    return trimmed;
  }
  return `${trimmed.slice(0, 47)}...`;
}

function ChatSessionView({
  authOverview,
  bootstrap,
  client,
  onPendingPromptConsumed,
  onSessionLabelUpdate,
  pendingActionPrompt,
}: {
  authOverview: AuthOverview | null;
  bootstrap: ChatBootstrap;
  client: SidecarClient | null;
  onPendingPromptConsumed?: (() => void) | undefined;
  onSessionLabelUpdate?: ((sessionId: string, label: string) => void) | undefined;
  pendingActionPrompt?: string | null | undefined;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const hasCustomLabelRef = useRef(bootstrap.messages.length > 0);
  const didMountRef = useRef(false);
  const pendingPromptSentRef = useRef(false);

  // Re-use existing Chat instance if one exists (preserves streaming state)
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

  const {
    error,
    messages,
    sendMessage,
    status,
    stop,
  } = useChat<ChatUIMessage>({ chat });

  // Auto-send hidden prompt for action card execution
  useEffect(() => {
    if (!pendingActionPrompt || pendingPromptSentRef.current) {
      return;
    }
    pendingPromptSentRef.current = true;
    hasCustomLabelRef.current = true; // Session already has a label from action title

    void sendMessage({ text: pendingActionPrompt });
    onPendingPromptConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingActionPrompt]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    list.scrollTo({
      behavior: didMountRef.current ? "smooth" : "instant",
      top: list.scrollHeight,
    });
    didMountRef.current = true;
  }, [messages, status]);

  // Synchronously filter out the first user message in action-initiated sessions.
  // Uses the persistent isActionSession() check — works on re-mount and refresh.
  const isAction = isActionSession(bootstrap.session.id);
  const visibleMessages = useMemo(() => {
    if (!isAction) {
      return messages;
    }
    const firstUserIdx = messages.findIndex((m) => m.role === "user");
    if (firstUserIdx === -1) {
      return messages;
    }
    return messages.filter((_, i) => i !== firstUserIdx);
  }, [isAction, messages]);

  const isStreaming = status === "streaming" || status === "submitted";
  const latestMessage = messages[messages.length - 1];
  const providerName =
    authOverview?.providers.find(
      (provider) =>
        provider.methods.some((method) => method.providerId === bootstrap.resolvedProviderId),
    )?.name ?? bootstrap.resolvedProviderId;

  const handleSubmit = useCallback(
    (prompt: { text: string; files?: import("ai").FileUIPart[] }) => {
      const text = prompt.text.trim();
      if (!text) {
        return;
      }
      // Fire-and-forget so PromptInput clears attachments immediately
      void sendMessage({
        text,
        ...(prompt.files?.length ? { files: prompt.files } : {}),
      });

      if (!hasCustomLabelRef.current && client) {
        hasCustomLabelRef.current = true;
        const label = deriveSessionLabel(text);
        void client.updateSessionLabel(bootstrap.session.id, label).then(() => {
          onSessionLabelUpdate?.(bootstrap.session.id, label);
        }).catch(() => {
          // Silently ignore — label is cosmetic
        });
      }
    },
    [bootstrap.session.id, client, onSessionLabelUpdate, sendMessage],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Agent/provider bar */}
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 lg:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <BotIcon className="size-3" />
            {bootstrap.agent.name}
          </span>
          {providerName ? (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {providerName}
              {bootstrap.resolvedModelId ? ` / ${bootstrap.resolvedModelId}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 lg:px-6"
      >
        {visibleMessages.length === 0 && isAction ? (
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <LoaderCircleIcon className="size-6 animate-spin text-primary/60" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Working on: {bootstrap.session.label ?? "Action"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Generating response…
                </p>
              </div>
            </div>
          </div>
        ) : visibleMessages.length === 0 && !isAction ? (
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-10 px-4 py-8 text-center">
            <div className="space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <SparklesIcon className="size-5" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  Start a conversation
                </h1>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Ask {bootstrap.agent.name} about marketing strategy, growth, and content.
                </p>
              </div>
            </div>

            <div className="grid w-full gap-3">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt.text}
                  type="button"
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-card p-4 text-left transition-all duration-150 hover:border-primary/30 hover:bg-accent/40"
                  onClick={() => {
                    void handleSubmit({ text: prompt.text });
                  }}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <prompt.icon className="size-4" />
                  </div>
                  <span className="text-sm font-medium leading-relaxed text-muted-foreground transition-colors group-hover:text-foreground">
                    {prompt.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          visibleMessages.map((message) => (
            <ChatMessage
              key={message.id}
              isStreaming={isStreaming && latestMessage?.id === message.id}
              message={message}
            />
          ))
        )}

        {isStreaming && latestMessage?.role === "user" ? (
          isAction && visibleMessages.length === 0 ? null : (
            <Message from="assistant">
              <Reasoning isStreaming>
                <ReasoningTrigger />
              </Reasoning>
            </Message>
          )
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/8 px-3.5 py-2.5 text-sm text-destructive">
            {error.message}
          </div>
        ) : null}
      </div>

      {/* Chat input */}
      <div className="border-t border-border/60 px-4 py-3 lg:px-6">
        <PromptInput
          accept="image/*,.pdf,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.sh,.bash,.zsh,.yaml,.yml,.toml,.xml,.html,.css,.scss,.sql,.r,.lua,.php,.pl,.ex,.exs,.hs,.ml,.scala,.clj,.dart,.vue,.svelte,.astro,.log,.env,.ini,.cfg,.conf,.diff,.patch"
          globalDrop
          multiple
          onSubmit={handleSubmit}
          className="mx-auto max-w-3xl"
        >
          <PromptInputHeader>
            <AttachmentPreviews />
          </PromptInputHeader>
          <PromptInputTextarea
            placeholder={`Message ${bootstrap.agent.name}...`}
          />
          <PromptInputFooter>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent className="!w-auto">
                <PromptInputActionAddAttachments label="Add files or images" />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputSubmit
              status={status}
              onStop={() => {
                void stop();
              }}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function AttachmentPreviews() {
  const { files, remove } = usePromptInputAttachments();

  if (files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="grid">
      {files.map((file) => (
        <Attachment data={file} key={file.id} onRemove={() => { remove(file.id); }}>
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

function getFileParts(message: ChatUIMessage) {
  return message.parts.filter(
    (part): part is import("ai").FileUIPart & { type: "file" } =>
      part.type === "file",
  );
}

function ChatMessage({
  isStreaming,
  message,
}: {
  isStreaming: boolean;
  message: ChatUIMessage;
}) {
  const activityParts = getActivityParts(message);
  const reasoningText = getReasoningText(message);
  const textParts = getTextParts(message);
  const fileParts = getFileParts(message);
  const fullText = textParts.join("\n\n");
  const isThinking =
    message.role === "assistant" &&
    isStreaming &&
    activityParts.some((activity) => activity.status === "active");

  if (message.role === "user") {
    const imageParts = fileParts.filter((f) => f.mediaType.startsWith("image/"));
    const docParts = fileParts.filter((f) => !f.mediaType.startsWith("image/"));

    return (
      <Message from="user">
        {imageParts.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            {imageParts.map((file, index) => (
              <img
                key={`${message.id}-img-${String(index)}`}
                alt={file.filename ?? "Attached image"}
                className="max-h-48 max-w-xs rounded-lg object-cover"
                src={file.url}
              />
            ))}
          </div>
        ) : null}
        {docParts.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            {docParts.map((file, index) => (
              <div
                key={`${message.id}-doc-${String(index)}`}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
              >
                <FileTextIcon className="size-4 shrink-0" />
                <span className="truncate">{file.filename ?? "File"}</span>
              </div>
            ))}
          </div>
        ) : null}
        <MessageContent>
          {textParts.map((part, index) => (
            <p key={`${message.id}-${String(index)}`} className="whitespace-pre-wrap">
              {part}
            </p>
          ))}
        </MessageContent>
        {fullText ? (
          <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
            <CopyAction text={fullText} />
          </div>
        ) : null}
      </Message>
    );
  }

  return (
    <Message from="assistant">
      {activityParts.length > 0 || isThinking ? (
        <Reasoning isStreaming={isThinking} defaultOpen={false}>
          <ReasoningTrigger />
        </Reasoning>
      ) : null}

      {reasoningText ? (
        <Reasoning defaultOpen={false}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      ) : null}

      {fullText ? (
        <MessageContent>
          <MessageResponse>{fullText}</MessageResponse>
          <MessageToolbar>
            <MessageActions>
              <CopyAction text={fullText} />
            </MessageActions>
          </MessageToolbar>
        </MessageContent>
      ) : null}
    </Message>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            onClick={() => {
              void navigator.clipboard.writeText(text);
              setCopied(true);
              window.setTimeout(() => {
                setCopied(false);
              }, 1500);
            }}
          >
            <CopyIcon className="size-3.5" />
            <span className="sr-only">Copy</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="px-2 py-1 text-xs">
          {copied ? "Copied!" : "Copy"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function toUiMessage(message: ChatBootstrap["messages"][number]): ChatUIMessage {
  return {
    id: message.id,
    metadata: {
      createdAt: message.createdAt,
    },
    parts: message.text
      ? [
          {
            text: message.text,
            type: "text" as const,
          },
        ]
      : [],
    role: message.role,
  };
}
