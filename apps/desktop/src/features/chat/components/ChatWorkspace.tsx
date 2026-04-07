import { Chat, useChat } from "@ai-sdk/react";
import {
  ArrowRightIcon,
  BotIcon,
  CopyIcon,
  CrosshairIcon,
  FileTextIcon,
  LoaderCircleIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
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
  MessageTimestamp,
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
import type { ChatScope } from "@/features/chat/lib/chat-scope";
import { useChatScope } from "@/features/chat/hooks/useChatScope";
import { ScopeIndicator } from "@/features/chat/components/ScopeIndicator";
import { ObjectiveBanner } from "@/features/chat/components/ObjectiveBanner";
import { RunContextBanner } from "@/features/chat/components/RunContextBanner";
import { cn } from "@/lib/utils";
import { SidecarClient } from "@/lib/sidecar/client";
import { isUnnamedSession } from "@/lib/utils/unnamed-session";
import { getSpecialistMeta, getSpecialistColors } from "@/features/agents/specialist-meta";
import { resolveSpecialistIcon } from "@/features/agents/specialist-icons";
import { SpecialistChatHeader } from "@/features/chat/components/SpecialistChatHeader";
import { detectGoalIntent } from "@/features/chat/lib/goal-detection";
import { detectMemoryCandidates } from "@/features/chat/lib/memory-detection";
import { detectHandoffSuggestions } from "@/features/chat/lib/handoff-detector";
import { useAutoArtifacts } from "@/features/chat/hooks/useAutoArtifacts";
import { useDismissedProposals } from "@/features/chat/hooks/useDismissedProposals";
import { useDismissedMemories } from "@/features/chat/hooks/useDismissedMemories";
import { useDismissedHandoffs } from "@/features/chat/hooks/useDismissedHandoffs";
import { ProposalCard } from "@/features/chat/components/ProposalCard";
import { MemoryCandidateChip } from "@/features/chat/components/MemoryCandidateChip";
import { HandoffChip } from "@/features/chat/components/HandoffChip";

/**
 * Cache of Chat instances keyed by session ID.
 * Keeps streaming state alive when the user switches between sessions.
 */
export const chatCache = new Map<string, Chat<ChatUIMessage>>();

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

// Also hydrate from opengoat:actionSessionMeta (sessions may only exist there)
try {
  const metaRaw = localStorage.getItem("opengoat:actionSessionMeta");
  if (metaRaw) {
    const meta: unknown = JSON.parse(metaRaw);
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      for (const id of Object.keys(meta as Record<string, unknown>)) {
        actionSessionIds.add(id);
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

/**
 * Known starter action label prefixes.
 * Used as a heuristic fallback when localStorage is empty (e.g. cleared data,
 * different device, fresh session). Matches are conservative — only threads
 * whose labels start with a known action name are detected.
 */
const ACTION_LABEL_PREFIXES = [
  "Launch on Product Hunt",
  "Rewrite homepage hero",
  "Improve homepage conversion",
  "Build outbound sequence",
  "Find SEO quick wins",
  "Create comparison page outline",
  "Generate founder content ideas",
  "Create lead magnet ideas",
];

/**
 * Heuristic fallback: check if a session label matches a known starter action.
 * Returns true if the label starts with any known action prefix.
 */
export function isLikelyActionSession(label: string): boolean {
  if (!label) return false;
  return ACTION_LABEL_PREFIXES.some((prefix) => label.startsWith(prefix));
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
  // Fallback: check if session has action metadata (opengoat:actionSessionMeta)
  try {
    const metaRaw = localStorage.getItem("opengoat:actionSessionMeta");
    if (metaRaw) {
      const meta: unknown = JSON.parse(metaRaw);
      if (meta && typeof meta === "object" && !Array.isArray(meta) && (meta as Record<string, unknown>)[sessionId]) {
        actionSessionIds.add(sessionId); // backfill the set
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
  currentSpecialistId?: string | undefined;
  currentSpecialistName?: string | undefined;
  initialScope?: ChatScope | null | undefined;
  onBootstrap?: ((sessionId: string) => void) | undefined;
  onInitialScopeConsumed?: (() => void) | undefined;
  onNavigate?: ((specialistId: string) => void) | undefined;
  onPendingPromptConsumed?: (() => void) | undefined;
  onSessionLabelUpdate?: ((sessionId: string, label: string) => void) | undefined;
  pendingActionPrompt?: string | null | undefined;
  pendingHandoffContext?: string | null | undefined;
  onHandoffContextConsumed?: (() => void) | undefined;
  sessionId?: string | undefined;
}

const DEFAULT_STARTER_PROMPTS: { icon: LucideIcon; text: string }[] = [
  { icon: TrendingUpIcon, text: "What's the highest-leverage marketing move for my company right now?" },
  { icon: FileTextIcon, text: "What's the first marketing deliverable I should create?" },
  { icon: CrosshairIcon, text: "Summarize opportunities across all marketing channels." },
];

export function ChatWorkspace({
  agentId,
  authOverview,
  client,
  currentSpecialistId,
  currentSpecialistName,
  initialScope,
  onBootstrap,
  onHandoffContextConsumed,
  onInitialScopeConsumed,
  onNavigate,
  onPendingPromptConsumed,
  onSessionLabelUpdate,
  pendingActionPrompt,
  pendingHandoffContext,
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
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/8">
            <LoaderCircleIcon className="size-5 animate-spin text-primary/60" />
          </div>
          <p className="text-[13px] text-muted-foreground/60">Loading conversation...</p>
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
      agentId={agentId}
      authOverview={authOverview}
      bootstrap={bootstrap}
      client={client}
      currentSpecialistId={currentSpecialistId}
      currentSpecialistName={currentSpecialistName}
      initialScope={initialScope}
      onHandoffContextConsumed={onHandoffContextConsumed}
      onInitialScopeConsumed={onInitialScopeConsumed}
      onNavigate={onNavigate}
      onPendingPromptConsumed={onPendingPromptConsumed}
      onSessionLabelUpdate={onSessionLabelUpdate}
      pendingActionPrompt={pendingActionPrompt}
      pendingHandoffContext={pendingHandoffContext}
    />
  );
}

function deriveSessionLabel(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 55) {
    return trimmed;
  }
  return `${trimmed.slice(0, 52)}...`;
}

function ChatSessionView({
  agentId,
  authOverview,
  bootstrap,
  client,
  currentSpecialistId,
  currentSpecialistName,
  initialScope,
  onHandoffContextConsumed,
  onInitialScopeConsumed,
  onNavigate,
  onPendingPromptConsumed,
  onSessionLabelUpdate,
  pendingActionPrompt,
  pendingHandoffContext,
}: {
  agentId?: string | undefined;
  authOverview: AuthOverview | null;
  bootstrap: ChatBootstrap;
  client: SidecarClient | null;
  currentSpecialistId?: string | undefined;
  currentSpecialistName?: string | undefined;
  initialScope?: ChatScope | null | undefined;
  onHandoffContextConsumed?: (() => void) | undefined;
  onInitialScopeConsumed?: (() => void) | undefined;
  onNavigate?: ((specialistId: string) => void) | undefined;
  onPendingPromptConsumed?: (() => void) | undefined;
  onSessionLabelUpdate?: ((sessionId: string, label: string) => void) | undefined;
  pendingActionPrompt?: string | null | undefined;
  pendingHandoffContext?: string | null | undefined;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const hasCustomLabelRef = useRef(
    bootstrap.messages.length > 0 && !isUnnamedSession(bootstrap.session.label),
  );
  const didMountRef = useRef(false);
  const pendingPromptSentRef = useRef(false);
  const handoffContextSentRef = useRef(false);
  const initialScopeAppliedRef = useRef(false);

  // Auto-fix generic labels for existing sessions that already have messages
  useEffect(() => {
    if (hasCustomLabelRef.current || !client) return;
    const firstUserMsg = bootstrap.messages.find((m) => m.role === "user");
    if (!firstUserMsg?.text?.trim()) return;
    hasCustomLabelRef.current = true;
    const label = deriveSessionLabel(firstUserMsg.text);
    void client.updateSessionLabel(bootstrap.session.id, label).then(() => {
      onSessionLabelUpdate?.(bootstrap.session.id, label);
    }).catch(() => {
      // Silently ignore — label is cosmetic
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap.session.id]);

  // Chat scope management
  const { scope, setScope, clearScope } = useChatScope(bootstrap.session.id);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  // Apply initial scope from external navigation (e.g., Dashboard → Chat)
  useEffect(() => {
    if (initialScope && !initialScopeAppliedRef.current) {
      initialScopeAppliedRef.current = true;
      setScope(initialScope);
      onInitialScopeConsumed?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScope]);

  // Effective specialist: prefer URL param, fall back to session metadata
  const effectiveSpecialistId = currentSpecialistId ?? bootstrap.session.specialistId;
  const effectiveSpecialistMeta = effectiveSpecialistId
    ? getSpecialistMeta(effectiveSpecialistId)
    : undefined;

  // Specialist-colored avatar for streaming indicator
  const streamingSpecialistAvatar = useMemo(() => {
    if (!effectiveSpecialistId) return undefined;
    const colors = getSpecialistColors(effectiveSpecialistId);
    const SpecIcon = effectiveSpecialistMeta ? resolveSpecialistIcon(effectiveSpecialistMeta.icon) : SparklesIcon;
    return (
      <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", colors.iconBg)}>
        <SpecIcon className={cn("size-4", colors.iconText)} />
      </div>
    );
  }, [effectiveSpecialistId, effectiveSpecialistMeta]);

  // Starter prompts: specialist-specific or default CMO starters
  const starterPrompts = useMemo(() => {
    if (!effectiveSpecialistId) return DEFAULT_STARTER_PROMPTS;
    const meta = getSpecialistMeta(effectiveSpecialistId);
    if (!meta) return DEFAULT_STARTER_PROMPTS;
    return meta.starterSuggestions.map((text) => ({
      icon: SparklesIcon as LucideIcon,
      text,
    }));
  }, [effectiveSpecialistId]);

  // Re-use existing Chat instance if one exists (preserves streaming state)
  const chat = useMemo(() => {
    const existing = chatCache.get(bootstrap.session.id);
    if (existing) {
      return existing;
    }
    const transport = createChatTransport({
      agentId: bootstrap.agent.id,
      client,
      getScope: () => {
        const s = scopeRef.current;
        if (s.type === "objective") {
          return { type: "objective", objectiveId: s.objectiveId };
        }
        if (s.type === "run") {
          return { type: "run", objectiveId: s.objectiveId, runId: s.runId };
        }
        return null;
      },
      specialistId: currentSpecialistId ?? bootstrap.session.specialistId,
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

  // Auto-persist outputs as artifacts for the RECENT OUTPUTS dashboard section
  useAutoArtifacts({
    messages,
    status,
    client,
    agentId,
    specialistId: effectiveSpecialistId,
    sessionId: bootstrap.session.id,
  });

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

  // Auto-send handoff context as first message when arriving from a handoff chip
  useEffect(() => {
    if (!pendingHandoffContext || handoffContextSentRef.current) {
      return;
    }
    handoffContextSentRef.current = true;
    void sendMessage({ text: pendingHandoffContext });
    onHandoffContextConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHandoffContext]);

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

  // Compute last assistant message ID and recent user texts for detection
  const lastAssistantId = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const msg = visibleMessages[i];
      if (msg && msg.role === "assistant") return msg.id;
    }
    return undefined;
  }, [visibleMessages]);

  const recentUserTexts = useMemo(() => {
    const texts: string[] = [];
    for (let i = messages.length - 1; i >= 0 && texts.length < 3; i--) {
      const msg = messages[i];
      if (msg && msg.role === "user") {
        const parts = getTextParts(msg);
        if (parts.length > 0) texts.unshift(parts.join(" "));
      }
    }
    return texts;
  }, [messages]);

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
      <div className="flex items-center gap-3 border-b border-border/20 bg-card/30 px-4 py-2 lg:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {effectiveSpecialistMeta && effectiveSpecialistId ? (
            <SpecialistChatHeader
              specialistId={effectiveSpecialistId}
              specialistName={effectiveSpecialistMeta.name}
              specialistRole={effectiveSpecialistMeta.role}
              specialistIcon={effectiveSpecialistMeta.icon}
            />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <BotIcon className="size-3" />
              {bootstrap.agent.name}
            </span>
          )}
          {providerName ? (
            <span className="rounded-md bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground/50">
              {providerName}
              {bootstrap.resolvedModelId ? ` / ${bootstrap.resolvedModelId}` : ""}
            </span>
          ) : null}
          <ScopeIndicator
            scope={scope}
            onClear={clearScope}
          />
        </div>
      </div>

      {/* Objective banner — between header and messages */}
      {client && agentId && (scope.type === "objective" || scope.type === "run") ? (
        <div className="relative">
          <ObjectiveBanner
            scope={scope}
            setScope={setScope}
            client={client}
            agentId={agentId}
          />
        </div>
      ) : null}

      {/* Run context banner — playbook phase info for run-scoped chats */}
      {client && scope.type === "run" ? (
        <RunContextBanner
          runId={scope.runId}
          client={client}
        />
      ) : null}

      {/* Messages area */}
      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pt-6 pb-36 lg:px-6"
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
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-12 px-4 py-12 text-center">
            <div className="space-y-5">
              {(() => {
                const specColors = effectiveSpecialistId ? getSpecialistColors(effectiveSpecialistId) : undefined;
                const SpecIcon = effectiveSpecialistMeta ? resolveSpecialistIcon(effectiveSpecialistMeta.icon) : SparklesIcon;
                return (
                  <div className={cn(
                    "mx-auto flex size-14 items-center justify-center rounded-2xl shadow-sm ring-1",
                    specColors ? cn(specColors.iconBg, specColors.iconText, "ring-black/[0.04] dark:ring-white/[0.06]") : "bg-primary/8 ring-primary/10 text-primary",
                  )}>
                    <SpecIcon className="size-6" />
                  </div>
                );
              })()}
              <div className="space-y-2.5">
                <h1 className="font-display text-[24px] font-bold tracking-[-0.02em] text-foreground">
                  {effectiveSpecialistMeta
                    ? `Chat with ${effectiveSpecialistMeta.name}`
                    : "Start a conversation"}
                </h1>
                <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted-foreground/60">
                  {effectiveSpecialistMeta
                    ? effectiveSpecialistMeta.role
                    : "Get marketing deliverables, strategy recommendations, and competitive insights."}
                </p>
              </div>
            </div>

            <div className="w-full space-y-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40">Try asking</p>
              <div className="grid w-full gap-2.5 sm:grid-cols-2 sm:[&>:last-child:nth-child(2n+1)]:col-span-full">
                {starterPrompts.map((prompt) => {
                  const specColors = effectiveSpecialistId ? getSpecialistColors(effectiveSpecialistId) : undefined;
                  return (
                    <button
                      key={prompt.text}
                      type="button"
                      className={cn(
                        "group/starter flex cursor-pointer items-start gap-3 rounded-xl border bg-card/50 px-4 py-3.5 text-left transition-all duration-100 hover:-translate-y-0.5 hover:bg-card/80 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20",
                        specColors
                          ? cn("border-border/20 dark:border-white/[0.04]", specColors.hoverBorder)
                          : "border-border/20 hover:border-primary/20 dark:border-white/[0.04] dark:hover:border-primary/15",
                      )}
                      onClick={() => {
                        void handleSubmit({ text: prompt.text });
                      }}
                    >
                      <div className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors group-hover/starter:text-white",
                        specColors
                          ? cn(specColors.iconBg, specColors.iconText, specColors.starterHoverIconBg)
                          : "bg-primary/8 text-primary/70 group-hover/starter:bg-primary group-hover/starter:text-primary-foreground",
                      )}>
                        <prompt.icon className="size-4" />
                      </div>
                      <span className="flex-1 text-[13px] font-medium leading-snug text-muted-foreground/70 transition-colors group-hover/starter:text-foreground">
                        {prompt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          visibleMessages.map((message) => (
            <ChatMessage
              key={message.id}
              isStreaming={isStreaming && latestMessage?.id === message.id}
              message={message}
              isLastAssistant={message.id === lastAssistantId}
              recentUserTexts={recentUserTexts}
              scope={scope}
              setScope={setScope}
              client={client}
              agentId={agentId}
              sessionId={bootstrap.session.id}
              currentSpecialistId={currentSpecialistId}
              currentSpecialistName={currentSpecialistName}
              specialistAvatar={streamingSpecialistAvatar}
              onNavigate={onNavigate}
            />
          ))
        )}

        {isStreaming && latestMessage?.role === "user" ? (
          isAction && visibleMessages.length === 0 ? null : (
            <Message from="assistant" avatar={streamingSpecialistAvatar}>
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
      <div className="border-t border-border/30 bg-card/30 px-4 py-3.5 lg:px-6">
        <div className="mx-auto max-w-3xl rounded-xl bg-gradient-to-r from-border/40 via-border/40 to-border/40 p-[1px] transition-all duration-200 hover:from-border/60 hover:via-border/60 hover:to-border/60 focus-within:from-primary/40 focus-within:via-primary/20 focus-within:to-primary/40 focus-within:shadow-lg focus-within:shadow-primary/10 dark:from-white/[0.06] dark:via-white/[0.06] dark:to-white/[0.06] dark:hover:from-white/[0.10] dark:hover:via-white/[0.10] dark:hover:to-white/[0.10] dark:focus-within:from-primary/40 dark:focus-within:via-primary/20 dark:focus-within:to-primary/40 [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:rounded-[11px]">
        <PromptInput
          accept="image/*,.pdf,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.sh,.bash,.zsh,.yaml,.yml,.toml,.xml,.html,.css,.scss,.sql,.r,.lua,.php,.pl,.ex,.exs,.hs,.ml,.scala,.clj,.dart,.vue,.svelte,.astro,.log,.env,.ini,.cfg,.conf,.diff,.patch"
          globalDrop
          multiple
          onSubmit={handleSubmit}
        >
          <PromptInputHeader>
            <AttachmentPreviews />
          </PromptInputHeader>
          <PromptInputTextarea
            placeholder={`Message ${effectiveSpecialistMeta?.name ?? bootstrap.agent.name}...`}
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
  isLastAssistant,
  recentUserTexts,
  scope,
  setScope,
  client,
  agentId,
  sessionId,
  currentSpecialistId,
  currentSpecialistName,
  specialistAvatar,
  onNavigate,
}: {
  isStreaming: boolean;
  message: ChatUIMessage;
  isLastAssistant?: boolean | undefined;
  recentUserTexts?: string[] | undefined;
  scope?: ChatScope | undefined;
  setScope?: ((scope: ChatScope) => void) | undefined;
  client?: SidecarClient | null | undefined;
  agentId?: string | undefined;
  sessionId?: string | undefined;
  currentSpecialistId?: string | undefined;
  currentSpecialistName?: string | undefined;
  specialistAvatar?: ReactNode | undefined;
  onNavigate?: ((specialistId: string) => void) | undefined;
}) {
  const activityParts = getActivityParts(message);
  const reasoningText = getReasoningText(message);
  const textParts = getTextParts(message);
  const fileParts = getFileParts(message);
  const fullText = textParts.join("\n\n");
  const createdAt = (message.metadata as { createdAt?: string } | undefined)?.createdAt;
  const isThinking =
    message.role === "assistant" &&
    isStreaming &&
    activityParts.some((activity) => activity.status === "active");

  // Detection — only on the last non-streaming assistant message
  const shouldDetect =
    message.role === "assistant" &&
    isLastAssistant &&
    !isStreaming &&
    fullText.length > 0;

  const goalResult = useMemo(() => {
    if (!shouldDetect || !recentUserTexts) return { detected: false, goalPhrase: "", confidence: 0 };
    return detectGoalIntent(recentUserTexts, fullText);
  }, [shouldDetect, recentUserTexts, fullText]);

  const memoryCandidates = useMemo(() => {
    if (!shouldDetect) return [];
    return detectMemoryCandidates(fullText);
  }, [shouldDetect, fullText]);

  // Handoff detection uses useEffect + useState instead of useMemo to guarantee
  // detection runs after React commits the render with final streaming state.
  // useMemo can miss the shouldDetect transition when useSyncExternalStore
  // updates status and messages in separate microtasks.
  const [handoffSuggestions, setHandoffSuggestions] = useState<
    import("@/features/chat/lib/handoff-detector").HandoffSuggestion[]
  >([]);
  useEffect(() => {
    if (!shouldDetect) {
      setHandoffSuggestions((prev) => (prev.length > 0 ? [] : prev));
      return;
    }
    setHandoffSuggestions(
      detectHandoffSuggestions(fullText, currentSpecialistId),
    );
  }, [shouldDetect, fullText, currentSpecialistId]);

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
        <div className="flex items-center justify-end gap-2">
          <MessageTimestamp date={createdAt} />
          {fullText ? (
            <div className="opacity-0 transition-opacity group-hover:opacity-100">
              <CopyAction text={fullText} />
            </div>
          ) : null}
        </div>
      </Message>
    );
  }

  return (
    <Message from="assistant" avatar={specialistAvatar}>
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
            {!isStreaming && <MessageTimestamp date={createdAt} />}
          </MessageToolbar>
        </MessageContent>
      ) : null}

      {/* Goal-to-objective proposal card */}
      {goalResult.detected && sessionId && scope && setScope && client && agentId ? (
        <ChatProposalCardWrapper
          goalPhrase={goalResult.goalPhrase}
          sessionId={sessionId}
          scope={scope}
          setScope={setScope}
          client={client}
          agentId={agentId}
        />
      ) : null}

      {/* Memory candidate chips */}
      {memoryCandidates.length > 0 && sessionId && scope && client && agentId ? (
        <ChatMemoryCandidatesWrapper
          candidates={memoryCandidates}
          sessionId={sessionId}
          scope={scope}
          client={client}
          agentId={agentId}
        />
      ) : null}

      {/* Handoff suggestion chips */}
      {handoffSuggestions.length > 0 && sessionId ? (
        <ChatHandoffChipsWrapper
          suggestions={handoffSuggestions}
          sessionId={sessionId}
          currentSpecialistName={currentSpecialistName}
          onNavigate={onNavigate}
        />
      ) : null}
    </Message>
  );
}

/** Wrapper that uses the dismissed-proposals hook (hooks can't be conditional). */
function ChatProposalCardWrapper({
  goalPhrase,
  sessionId,
  scope,
  setScope,
  client,
  agentId,
}: {
  goalPhrase: string;
  sessionId: string;
  scope: ChatScope;
  setScope: (scope: ChatScope) => void;
  client: SidecarClient;
  agentId: string;
}) {
  const { isDismissed, dismiss } = useDismissedProposals(sessionId);
  if (isDismissed) return null;
  return (
    <ProposalCard
      goalPhrase={goalPhrase}
      sessionId={sessionId}
      scope={scope}
      setScope={setScope}
      client={client}
      agentId={agentId}
      onDismiss={dismiss}
    />
  );
}

/** Wrapper that uses the dismissed-memories hook (hooks can't be conditional). */
function ChatMemoryCandidatesWrapper({
  candidates,
  sessionId,
  scope,
  client,
  agentId,
}: {
  candidates: import("@/features/chat/lib/memory-detection").MemoryCandidate[];
  sessionId: string;
  scope: ChatScope;
  client: SidecarClient;
  agentId: string;
}) {
  const { dismissedIds, dismiss } = useDismissedMemories(sessionId);
  const visible = candidates.filter((c) => !dismissedIds.has(c.id));
  if (visible.length === 0) return null;
  return (
    <div className="space-y-0">
      {visible.map((candidate) => (
        <MemoryCandidateChip
          key={candidate.id}
          candidateId={candidate.id}
          content={candidate.content}
          suggestedCategory={candidate.suggestedCategory}
          suggestedScope={candidate.suggestedScope}
          confidence={candidate.confidence}
          scope={scope}
          client={client}
          agentId={agentId}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}

/** Wrapper that uses the dismissed-handoffs hook (hooks can't be conditional). */
function ChatHandoffChipsWrapper({
  suggestions,
  sessionId,
  currentSpecialistName,
  onNavigate,
}: {
  suggestions: import("@/features/chat/lib/handoff-detector").HandoffSuggestion[];
  sessionId: string;
  currentSpecialistName?: string | undefined;
  onNavigate?: ((specialistId: string) => void) | undefined;
}) {
  const { dismissedIds, dismiss } = useDismissedHandoffs(sessionId);
  const visible = suggestions.filter((s) => !dismissedIds.has(s.id));
  if (visible.length === 0) return null;
  return (
    <div className="relative z-10 space-y-0">
      {visible.map((suggestion) => (
        <HandoffChip
          key={suggestion.id}
          specialistId={suggestion.specialistId}
          specialistName={suggestion.specialistName}
          reason={suggestion.reason}
          currentSpecialistName={currentSpecialistName}
          onDismiss={() => dismiss(suggestion.id)}
          onNavigate={onNavigate}
        />
      ))}
    </div>
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
