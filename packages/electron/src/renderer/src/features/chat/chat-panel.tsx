import { useChat } from "@ai-sdk/react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@renderer/components/ai-elements/prompt-input";
import { Button } from "@renderer/components/ui/button";
import { cn } from "@renderer/lib/utils";
import type {
  WorkbenchGatewayStatus,
  WorkbenchMessage,
  WorkbenchProject,
  WorkbenchSession,
} from "@shared/workbench";
import { WORKBENCH_CHAT_ERROR_PROVIDER_ID } from "@shared/workbench";
import { ChevronDown, Loader2, Settings2 } from "lucide-react";
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

  useEffect(() => {
    setMessages(initialMessages);
    setInput("");
  }, [chatId, initialMessages, setMessages]);

  const isSubmitting = status === "submitted" || status === "streaming";
  const canSend = Boolean(
    props.activeSession &&
    input.trim().length > 0 &&
    !isSubmitting &&
    !props.busy,
  );
  const resolvedError = chatError?.message ?? props.error;

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
