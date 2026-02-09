import { useChat } from "@ai-sdk/react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@renderer/components/ai-elements/prompt-input";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@renderer/components/ai-elements/task";
import { Button } from "@renderer/components/ui/button";
import { cn } from "@renderer/lib/utils";
import type {
  WorkbenchGatewayStatus,
  WorkbenchMessage,
  WorkbenchProject,
  WorkbenchRunStatusEvent,
  WorkbenchSession,
} from "@shared/workbench";
import { WORKBENCH_CHAT_ERROR_PROVIDER_ID } from "@shared/workbench";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Loader2,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createElectronChatTransport,
  getTextContent,
  toElectronUiMessages,
  type ElectronUiMessage,
} from "./electron-chat-transport";

interface ChatPanelProps {
  homeDir: string;
  activeProject: WorkbenchProject | null;
  activeSession: WorkbenchSession | null;
  messages: WorkbenchMessage[];
  runStatusEvents: WorkbenchRunStatusEvent[];
  gateway?: WorkbenchGatewayStatus;
  error: string | null;
  busy: boolean;
  onSubmitMessage: (message: string) => Promise<WorkbenchMessage | null>;
  onOpenRuntimeSettings: () => void;
  onOpenOnboarding: () => void;
  onDismissError: () => void;
}

export function ChatPanel(props: ChatPanelProps) {
  const gatewayMode = props.gateway?.mode ?? "local";
  const gatewayHost = resolveGatewayHost(props.gateway?.remoteUrl);
  const chatId = `${props.activeProject?.id ?? "none"}:${props.activeSession?.id ?? "none"
    }`;
  const initialMessages = useMemo(
    () => toElectronUiMessages(props.messages),
    [props.messages],
  );
  const transport = useMemo(
    () =>
      createElectronChatTransport({
        submitMessage: async (message: string) =>
          props.onSubmitMessage(message),
      }),
    [props.onSubmitMessage],
  );
  const {
    messages,
    sendMessage,
    setMessages,
    clearError,
    status,
    error: chatError,
  } = useChat<ElectronUiMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
  });
  const [input, setInput] = useState("");
  const [loadingStartedAtMs, setLoadingStartedAtMs] = useState<number | null>(
    null,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    setMessages(initialMessages);
    setInput("");
  }, [chatId, initialMessages, setMessages]);

  const isSubmitting = status === "submitted" || status === "streaming";
  const showRunProgress =
    Boolean(props.activeSession) && (isSubmitting || props.busy);
  const canSend = Boolean(
    props.activeSession &&
    input.trim().length > 0 &&
    !isSubmitting &&
    !props.busy,
  );
  const resolvedError = chatError?.message ?? props.error;
  const runProgress = useMemo(
    () => buildRunProgress(props.runStatusEvents, elapsedSeconds, gatewayMode),
    [elapsedSeconds, gatewayMode, props.runStatusEvents],
  );

  useEffect(() => {
    if (showRunProgress) {
      setLoadingStartedAtMs((current) => current ?? Date.now());
      return;
    }

    setLoadingStartedAtMs(null);
    setElapsedSeconds(0);
  }, [showRunProgress]);

  useEffect(() => {
    if (!showRunProgress || loadingStartedAtMs === null) {
      return;
    }

    const updateElapsed = () => {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - loadingStartedAtMs) / 1000)),
      );
    };

    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [showRunProgress, loadingStartedAtMs]);

  const handlePromptSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text || !props.activeSession || isSubmitting || props.busy) {
      return;
    }

    setInput("");
    await sendMessage({ text });
  };

  return (
    <main className="flex h-full min-h-0 min-w-0 flex-col bg-transparent">
      <header className="titlebar-drag-region sticky top-0 z-30 border-0 bg-[#1F1F1F] px-4 shadow-[0_10px_24px_rgba(0,0,0,0.42)] md:px-5">
        <div className="flex h-12 items-center justify-between gap-3">
          <div className="min-w-0 truncate text-base leading-none tracking-tight">
            <span className="truncate font-heading font-semibold text-foreground">
              {props.activeSession?.title ?? "No session"}
            </span>
            <span className="ml-2 truncate font-medium text-muted-foreground">
              {props.activeProject?.name ?? "No project"}
            </span>
          </div>
          <div className="titlebar-no-drag flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={
                gatewayMode === "remote"
                  ? "h-8 gap-1 rounded-lg border border-[#2E2F31] bg-[#161617] px-3 text-amber-100 hover:bg-[#1D1D1F]"
                  : "h-8 gap-1 rounded-lg border border-[#2E2F31] bg-[#161617] px-3 text-emerald-100 hover:bg-[#1D1D1F]"
              }
              onClick={props.onOpenRuntimeSettings}
              disabled={props.busy || isSubmitting}
            >
              {gatewayMode === "remote"
                ? `Remote${gatewayHost ? `: ${gatewayHost}` : " Gateway"}`
                : "Local Runtime"}
              <ChevronDown className="size-3.5 opacity-80" />
            </Button>
            <Button
              variant="outline"
              className="h-8 gap-2 rounded-lg border border-[#2E2F31] bg-[#161617] px-3 text-foreground/95 hover:bg-[#1D1D1F]"
              onClick={props.onOpenOnboarding}
              disabled={props.busy || isSubmitting}
            >
              <Settings2 className="size-4" />
              Provider Setup
            </Button>
          </div>
        </div>
      </header>
      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
        <div className="mx-auto w-full max-w-4xl space-y-4 pb-6">
          {!props.activeSession ? (
            <div className="rounded-xl border border-[#2E2F31] bg-[#141416] px-4 py-6 text-sm text-muted-foreground">
              Select or create a session to start chatting.
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-xl border border-[#2E2F31] bg-[#141416] px-4 py-6 text-sm text-muted-foreground">
              Send a message to begin this session.
            </div>
          ) : (
            messages.map((message, index) => {
              const content = getTextContent(message).trim();
              const isError =
                message.metadata?.providerId === WORKBENCH_CHAT_ERROR_PROVIDER_ID;
              const isUser = message.role === "user";
              const isAssistant = message.role === "assistant" && !isError;
              const isStreamingAssistant =
                isAssistant && index === messages.length - 1 && isSubmitting;
              if (!content && !isStreamingAssistant) {
                return null;
              }

              return (
                <article
                  key={message.id}
                  className={cn(
                    "flex",
                    isUser ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "w-full max-w-[min(72ch,100%)] rounded-xl border px-4 py-3",
                      isUser
                        ? "border-[#30415F] bg-[#1C2638]"
                        : isError
                          ? "border-[#5B2A2E] bg-[#2A1417]"
                          : "border-[#2E2F31] bg-[#141416]"
                    )}
                  >
                    <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {isUser ? "You" : isError ? "Error" : isAssistant ? "Assistant" : "System"}
                    </p>
                    {content ? (
                      <p
                        className={cn(
                          "whitespace-pre-wrap break-words text-sm leading-6",
                          isError ? "text-red-200" : "text-foreground/95"
                        )}
                      >
                        {content}
                      </p>
                    ) : null}
                    {isStreamingAssistant && !content ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Thinking...
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
          {showRunProgress ? (
            <article className="flex justify-start">
              <div className="w-full max-w-[min(72ch,100%)] rounded-xl border border-[#2E2F31] bg-[#141416] px-4 py-3">
                <Task className="w-full" defaultOpen>
                  <TaskTrigger title={runProgress.title}>
                    <div className="flex w-full items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin text-emerald-300" />
                      <p className="font-medium text-foreground/90">
                        {runProgress.title}
                      </p>
                      <span className="ml-auto text-xs text-muted-foreground/90">
                        {formatElapsed(elapsedSeconds)}
                      </span>
                    </div>
                  </TaskTrigger>
                  <TaskContent>
                    {runProgress.steps.map((step) => (
                      <TaskItem
                        key={step.id}
                        className="flex items-start gap-2 text-foreground/90"
                      >
                        <span className="mt-0.5">
                          {step.state === "done" ? (
                            <CheckCircle2 className="size-4 text-emerald-300" />
                          ) : step.state === "active" ? (
                            <Loader2 className="size-4 animate-spin text-emerald-300" />
                          ) : (
                            <Circle className="size-4 text-muted-foreground/80" />
                          )}
                        </span>
                        <span className="space-y-0.5">
                          <p className="text-sm font-medium leading-5">
                            {step.label}
                          </p>
                          <p className="text-sm leading-5 text-muted-foreground">
                            {step.description}
                          </p>
                        </span>
                      </TaskItem>
                    ))}
                  </TaskContent>
                </Task>
              </div>
            </article>
          ) : null}
        </div>
      </section>
      <footer className="titlebar-no-drag flex-none border-t border-[#2E2F31] bg-transparent px-4 py-3 backdrop-blur md:px-5">
        <div className="mx-auto w-full max-w-4xl">
          {resolvedError ? (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-destructive/35 bg-destructive/12 px-3 py-2 text-sm text-red-200">
              <span>{resolvedError}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  clearError();
                  props.onDismissError();
                }}
              >
                Dismiss
              </Button>
            </div>
          ) : null}

          <PromptInput
            className="w-full"
            inputGroupClassName="rounded-lg border border-[#2F3032] bg-[#19191A] shadow-none"
            onSubmit={handlePromptSubmit}
          >
            <PromptInputBody>
              <PromptInputTextarea
                className="min-h-16 px-3 py-2 text-sm"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={!props.activeSession || props.busy || isSubmitting}
                placeholder={
                  props.activeSession
                    ? "Message OpenGoat..."
                    : "Create a session first, then send a message."
                }
              />
            </PromptInputBody>
            <PromptInputFooter className="justify-end px-2 pb-2 pt-2">
              <PromptInputSubmit
                className="size-8 rounded-lg"
                disabled={!canSend}
                status={status}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </footer>
    </main>
  );
}

interface RunProgressStep {
  id: string;
  label: string;
  description: string;
  state: "done" | "active" | "pending";
}

interface RunProgressState {
  title: string;
  steps: RunProgressStep[];
}

function buildRunProgress(
  events: WorkbenchRunStatusEvent[],
  elapsedSeconds: number,
  gatewayMode: "local" | "remote",
): RunProgressState {
  if (events.length === 0) {
    return buildFallbackRunProgress(elapsedSeconds, gatewayMode);
  }

  const steps: RunProgressStep[] = [];

  const pushDone = (id: string, label: string, description: string) => {
    steps.push({ id, label, description, state: "done" });
  };

  const activate = (id: string, label: string, description: string) => {
    const currentActiveIndex = steps.findIndex((entry) => entry.state === "active");
    if (currentActiveIndex >= 0) {
      steps[currentActiveIndex] = {
        ...steps[currentActiveIndex],
        state: "done",
      };
    }
    steps.push({ id, label, description, state: "active" });
  };

  const completeActiveBy = (matcher: (entry: RunProgressStep) => boolean) => {
    const activeIndex = steps.findIndex(
      (entry) => entry.state === "active" && matcher(entry),
    );
    if (activeIndex >= 0) {
      steps[activeIndex] = {
        ...steps[activeIndex],
        state: "done",
      };
    }
  };

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!event) {
      continue;
    }
    const eventKey = `${event.stage}-${event.step ?? "na"}-${index}`;
    const agentLabel = formatIdentifier(event.agentId, "Orchestrator");
    const targetLabel = formatIdentifier(event.targetAgentId, "agent");
    const providerLabel = formatIdentifier(event.providerId, "provider runtime");

    switch (event.stage) {
      case "run_started":
        pushDone(
          eventKey,
          "Request queued",
          "Your message was added to this session and sent to the orchestrator.",
        );
        break;
      case "planner_started":
        activate(
          `planner-${event.step ?? index}`,
          "Orchestrator is planning",
          "Reviewing your request and deciding the best next step.",
        );
        break;
      case "planner_decision":
        completeActiveBy((entry) => entry.id === `planner-${event.step ?? index}`);
        if (event.actionType === "delegate_to_agent") {
          pushDone(
            eventKey,
            `Delegating to ${targetLabel}`,
            "The orchestrator delegated this task to a specialized agent.",
          );
        } else if (event.actionType === "respond_user" || event.actionType === "finish") {
          pushDone(
            eventKey,
            "Orchestrator is preparing the final reply",
            "The orchestrator is assembling the response for this chat.",
          );
        }
        break;
      case "delegation_started":
        pushDone(
          eventKey,
          `${targetLabel} selected`,
          event.providerId
            ? `Routing work to ${targetLabel} via ${providerLabel}.`
            : `Routing work to ${targetLabel}.`,
        );
        break;
      case "provider_invocation_started":
        activate(
          `provider-${event.agentId ?? "agent"}-${event.step ?? index}-${index}`,
          `${agentLabel} is working`,
          event.providerId
            ? `Calling ${providerLabel} to continue this request.`
            : "Calling the configured runtime provider.",
        );
        break;
      case "provider_invocation_completed":
        completeActiveBy(
          (entry) =>
            entry.id.startsWith(`provider-${event.agentId ?? "agent"}-${event.step ?? index}`),
        );
        if (typeof event.code === "number" && event.code !== 0) {
          pushDone(
            eventKey,
            `${agentLabel} returned an error`,
            event.providerId
              ? `${providerLabel} returned code ${event.code}.`
              : `Provider returned code ${event.code}.`,
          );
        }
        break;
      case "remote_call_started":
        activate(
          `remote-call-${event.runId ?? "active"}`,
          "Calling remote runtime",
          "Sending your request to the configured OpenGoat gateway.",
        );
        break;
      case "remote_call_completed":
        completeActiveBy((entry) => entry.id.startsWith("remote-call-"));
        pushDone(
          eventKey,
          "Remote runtime responded",
          "The gateway returned control to this desktop session.",
        );
        break;
      case "run_completed":
        completeActiveBy(() => true);
        pushDone(
          eventKey,
          "Response ready",
          "The run is complete and the answer is being rendered in chat.",
        );
        break;
      default:
        break;
    }
  }

  if (!steps.some((entry) => entry.state === "active")) {
    activate(
      `waiting-${events.length}`,
      "Awaiting final response",
      elapsedSeconds >= 60
        ? "Still running. Larger context, delegation chains, or provider latency can take longer."
        : "The request is still running. You can keep using OpenGoat while it completes.",
    );
  }

  const trimmedSteps = steps.slice(-8);
  const activeStep = [...trimmedSteps].reverse().find((entry) => entry.state === "active");

  return {
    title: activeStep?.label
      ? `${activeStep.label}`
      : elapsedSeconds >= 60
        ? "Orchestrator is still working on your request"
        : "Orchestrator is working on your request",
    steps: trimmedSteps,
  };
}

function buildFallbackRunProgress(
  elapsedSeconds: number,
  gatewayMode: "local" | "remote",
): RunProgressState {
  const runtimeLabel = gatewayMode === "remote" ? "remote runtime" : "local provider runtime";
  const steps: RunProgressStep[] = [
    {
      id: "queued",
      label: "Preparing your request",
      description: "Your message is attached to this session and queued.",
      state: "done",
    },
    {
      id: "runtime",
      label: `Calling ${runtimeLabel}`,
      description:
        gatewayMode === "remote"
          ? "OpenGoat is waiting for the remote gateway and provider response."
          : "OpenGoat is invoking your configured model provider.",
      state: "active",
    },
  ];

  return {
    title:
      elapsedSeconds >= 60
        ? "Orchestrator is still working on your request"
        : "Orchestrator is working on your request",
    steps,
  };
}

function formatIdentifier(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }
  return normalized
    .split(/[-_]/g)
    .map((segment) =>
      segment.length > 0
        ? `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`
        : segment,
    )
    .join(" ");
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function resolveGatewayHost(rawUrl?: string): string | null {
  const value = rawUrl?.trim();
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.host || null;
  } catch {
    return value;
  }
}
