import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { ChatStatus } from "ai";
import opengoatLogo from "../../../../../../assets/opengoat.png";
import {
  DEFAULT_AGENT_ID,
  ONBOARDING_WORKSPACE_NAME,
  buildInitialRoadmapPrompt,
  buildOnboardingSummaryForUser,
  clearOnboardingChatState,
  clearOnboardingPayload,
  createMessageId,
  fetchJson,
  loadOnboardingChatState,
  loadOnboardingPayload,
  normalizeRunError,
  saveOnboardingChatState,
  sendSessionMessageStream,
  type OnboardingChatMessage,
  type OnboardingChatState,
  type OnboardingPayload,
  type OnboardingSessionInfo,
  type WorkspaceSessionResponse,
} from "./shared";

export function OnboardChatPage(): ReactElement {
  const [payload] = useState<OnboardingPayload | null>(() =>
    loadOnboardingPayload(),
  );
  const [chatState, setChatState] = useState<OnboardingChatState>(() =>
    loadOnboardingChatState(),
  );
  const [chatStatus, setChatStatus] = useState<ChatStatus>("ready");
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runtimeStatusLine, setRuntimeStatusLine] = useState<string | null>(
    null,
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const hasMessages = chatState.messages.length > 0;

  const setAndPersistChatState = useCallback(
    (updater: (current: OnboardingChatState) => OnboardingChatState): void => {
      setChatState((current) => {
        const next = updater(current);
        saveOnboardingChatState(next);
        return next;
      });
    },
    [],
  );

  const ensureSession = useCallback(async (): Promise<OnboardingSessionInfo> => {
    if (chatState.sessionInfo) {
      return chatState.sessionInfo;
    }

    const response = await fetchJson<WorkspaceSessionResponse>(
      "/api/workspaces/session",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: DEFAULT_AGENT_ID,
          workspaceName: ONBOARDING_WORKSPACE_NAME,
        }),
      },
    );

    const sessionInfo: OnboardingSessionInfo = {
      agentId: response.agentId || DEFAULT_AGENT_ID,
      sessionRef: response.session.sessionKey,
      sessionId: response.session.sessionId,
    };
    setAndPersistChatState((current) => ({
      ...current,
      sessionInfo,
    }));
    return sessionInfo;
  }, [chatState.sessionInfo, setAndPersistChatState]);

  const appendMessage = useCallback(
    (message: OnboardingChatMessage): void => {
      setAndPersistChatState((current) => ({
        ...current,
        messages: [...current.messages, message],
      }));
    },
    [setAndPersistChatState],
  );

  const runAssistantTurn = useCallback(
    async (input: { userText: string; agentText: string }): Promise<void> => {
      setError(null);
      setRuntimeStatusLine(null);
      setChatStatus("streaming");

      appendMessage({
        id: createMessageId("user"),
        role: "user",
        content: input.userText,
      });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const sessionInfo = await ensureSession();
        const response = await sendSessionMessageStream(
          {
            agentId: sessionInfo.agentId,
            sessionRef: sessionInfo.sessionRef,
            message: input.agentText,
          },
          {
            signal: abortController.signal,
            onEvent: (event) => {
              if (event.type === "progress") {
                const trimmed = event.message.trim();
                if (trimmed) {
                  setRuntimeStatusLine(trimmed);
                }
              }
            },
          },
        );

        const assistantOutput =
          response.output.trim() || "Goat returned no output.";
        appendMessage({
          id: createMessageId("assistant"),
          role: "assistant",
          content: assistantOutput,
        });

        if (response.result.code !== 0) {
          setError(
            normalizeRunError(
              assistantOutput ||
                `Goat completed with code ${response.result.code}.`,
            ),
          );
          setChatStatus("error");
          return;
        }

        setChatStatus("ready");
      } catch (requestError) {
        if (isAbortError(requestError)) {
          setChatStatus("ready");
          return;
        }

        const message =
          requestError instanceof Error
            ? requestError.message
            : "Unable to send message to Goat.";
        setError(normalizeRunError(message));
        setChatStatus("error");
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [appendMessage, ensureSession],
  );

  const runInitialRoadmapTurn = useCallback(async (): Promise<void> => {
    if (!payload) {
      setInitializing(false);
      setError(
        "Onboarding data is missing. Go back and complete onboarding first.",
      );
      return;
    }

    setAndPersistChatState((current) => ({
      ...current,
      hasInitialRoadmapRequest: true,
    }));

    await runAssistantTurn({
      userText: buildOnboardingSummaryForUser(payload),
      agentText: buildInitialRoadmapPrompt(payload),
    });
    setInitializing(false);
  }, [payload, runAssistantTurn, setAndPersistChatState]);

  useEffect(() => {
    if (!payload) {
      setInitializing(false);
      setError("Onboarding data is missing. Please restart from /onboard.");
      return;
    }

    if (chatState.hasInitialRoadmapRequest) {
      setInitializing(false);
      return;
    }

    void runInitialRoadmapTurn();
  }, [payload, chatState.hasInitialRoadmapRequest, runInitialRoadmapTurn]);

  useEffect(() => {
    return () => {
      const controller = abortControllerRef.current;
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
    };
  }, []);

  const handlePromptSubmit = useCallback(
    async (message: PromptInputMessage): Promise<void> => {
      const text = message.text.trim();
      if (!text || !payload) {
        return;
      }
      await runAssistantTurn({
        userText: text,
        agentText: text,
      });
    },
    [payload, runAssistantTurn],
  );

  const handleStop = useCallback(() => {
    const controller = abortControllerRef.current;
    if (!controller || controller.signal.aborted) {
      return;
    }
    controller.abort();
  }, []);

  const sessionLabel = useMemo(() => {
    if (!chatState.sessionInfo) {
      return "Preparing Goat session...";
    }
    return `Session: ${chatState.sessionInfo.sessionRef}`;
  }, [chatState.sessionInfo]);

  return (
    <main
      className="opengoat-onboard-shell relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_18%_-5%,rgba(91,141,255,0.2),transparent_45%),radial-gradient(circle_at_85%_10%,rgba(38,213,184,0.14),transparent_34%),linear-gradient(160deg,#06070d_0%,#0a1121_46%,#06080f_100%)] text-foreground"
      style={{
        fontFamily: '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif',
      }}
    >
      <div className="-left-20 absolute top-20 size-72 rounded-full bg-sky-400/12 blur-3xl" />
      <div className="absolute bottom-16 right-0 size-72 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(circle_at_center,black_30%,transparent_85%)] opacity-35" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
        <section className="opengoat-onboard-hero-card rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_42%,rgba(255,255,255,0.01)_100%)] p-5 shadow-[0_30px_90px_rgba(2,6,23,0.58)] backdrop-blur-xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={opengoatLogo}
                alt="OpenGoat logo"
                className="size-11 rounded-full shadow-[0_10px_24px_rgba(30,144,255,0.28)]"
              />
              <div className="min-w-0">
                <h1 className="truncate font-semibold text-2xl text-white sm:text-3xl">
                  Chat with Goat
                </h1>
                <p className="truncate text-muted-foreground text-sm">
                  {sessionLabel}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                window.location.assign("/onboard");
              }}
              type="button"
              variant="secondary"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </div>
        </section>

        <section className="opengoat-onboard-flow mt-4 flex min-h-[60vh] flex-1 flex-col rounded-[24px] border border-white/10 bg-[linear-gradient(175deg,rgba(10,14,27,0.92)_0%,rgba(7,11,22,0.86)_100%)] p-4 shadow-[0_24px_70px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:p-6">
          {runtimeStatusLine && chatStatus === "streaming" ? (
            <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-lg border border-sky-200/20 bg-sky-400/10 px-3 py-2 text-sky-100 text-xs">
              <Spinner className="size-3 text-sky-100" />
              <span className="truncate">{runtimeStatusLine}</span>
            </div>
          ) : null}

          {error ? (
            <div className="mb-3 rounded-xl border border-danger/40 bg-danger/15 px-3 py-2 text-danger text-sm">
              {error}
            </div>
          ) : null}

          <div className="min-h-0 flex-1">
            <Conversation className="min-h-0 flex-1 rounded-xl border border-white/10 bg-black/20">
              <ConversationContent className="gap-4 p-4">
                {!hasMessages ? (
                  <ConversationEmptyState
                    icon={
                      initializing || chatStatus === "streaming" ? (
                        <Spinner className="size-9" />
                      ) : (
                        <MessageSquare className="size-9 text-muted-foreground" />
                      )
                    }
                    title={
                      initializing || chatStatus === "streaming"
                        ? "Starting roadmap chat..."
                        : "No messages yet"
                    }
                    description={
                      payload
                        ? "Goat will draft your roadmap and then you can iterate directly in chat."
                        : "Return to onboarding and submit your setup first."
                    }
                  />
                ) : (
                  chatState.messages.map((message) => (
                    <Message key={message.id} from={message.role}>
                      <MessageContent>
                        {message.role === "assistant" ? (
                          <MessageResponse>{message.content}</MessageResponse>
                        ) : (
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {message.content}
                          </p>
                        )}
                      </MessageContent>
                    </Message>
                  ))
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          </div>

          <div className="mt-4 shrink-0">
            <PromptInput
              className="shrink-0"
              onSubmit={(message) => {
                void handlePromptSubmit(message);
              }}
            >
              <PromptInputBody>
                <PromptInputTextarea
                  className="!border-0 !shadow-none"
                  disabled={!payload}
                  placeholder="Tell Goat what to change, refine, or prioritize..."
                />
              </PromptInputBody>
              <PromptInputFooter
                align="block-end"
                className="items-center justify-end gap-2 !border-0 bg-transparent px-2 pt-1 pb-2 shadow-none"
              >
                <PromptInputSubmit
                  className="ml-auto"
                  disabled={!payload}
                  onStop={handleStop}
                  status={chatStatus}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>

          {!payload ? (
            <div className="mt-4">
              <Button
                onClick={() => {
                  clearOnboardingPayload();
                  clearOnboardingChatState();
                  window.location.assign("/onboard");
                }}
                type="button"
              >
                Go to onboarding
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function isAbortError(error: unknown): boolean {
  if (!error) {
    return false;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return error instanceof Error && error.name === "AbortError";
}
