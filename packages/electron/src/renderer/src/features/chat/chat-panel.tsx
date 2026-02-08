import { useChat } from "@ai-sdk/react";
import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentOutput,
  AgentTool,
  AgentTools,
} from "@renderer/components/ai-elements/agent";
import { Badge } from "@renderer/components/ai-elements/badge";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@renderer/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@renderer/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@renderer/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@renderer/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@renderer/components/ai-elements/sources";
import {
  Suggestion,
  Suggestions,
} from "@renderer/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from "@renderer/components/ai-elements/tool";
import { Button } from "@renderer/components/ui/button";
import type {
  WorkbenchGatewayStatus,
  WorkbenchMessage,
  WorkbenchProject,
  WorkbenchSession,
} from "@shared/workbench";
import { tool as defineTool } from "ai";
import { Copy, FolderCode, Loader2, Settings2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
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
  onOpenOnboarding: () => void;
  onDismissError: () => void;
}

const starterPrompts = [
  "Summarize this project architecture.",
  "Find risky code paths and explain why.",
  "Propose the next three engineering tasks.",
];

export function ChatPanel(props: ChatPanelProps) {
  const gatewayMode = props.gateway?.mode ?? "local";
  const gatewayHost = resolveGatewayHost(props.gateway?.remoteUrl);
  const chatId = `${props.activeProject?.id ?? "none"}:${
    props.activeSession?.id ?? "none"
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

  const canSend = Boolean(
    props.activeSession &&
      input.trim().length > 0 &&
      status !== "submitted" &&
      status !== "streaming" &&
      !props.busy,
  );
  const resolvedError = chatError?.message ?? props.error;
  const sourceLinks = useMemo(() => {
    const links: Array<{ href: string; label: string }> = [];
    if (props.activeProject?.rootPath) {
      links.push({
        href: encodeURI(`file://${props.activeProject.rootPath}`),
        label: props.activeProject.rootPath,
      });
    }
    if (props.homeDir) {
      links.push({
        href: encodeURI(`file://${props.homeDir}`),
        label: props.homeDir,
      });
    }
    return links;
  }, [props.activeProject?.rootPath, props.homeDir]);
  const orchestratorTools = useMemo(
    () => [
      {
        id: "scan_workspace",
        definition: defineTool({
          description: "Scan the selected workspace and inspect source files.",
          inputSchema: z.object({
            projectPath: z
              .string()
              .describe("Absolute path to the selected project"),
            focus: z.string().optional().describe("Optional area to focus on"),
          }),
        }),
      },
      {
        id: "run_session",
        definition: defineTool({
          description: "Run an orchestrated session step and stream results.",
          inputSchema: z.object({
            sessionId: z.string().describe("Current session identifier"),
            prompt: z.string().describe("User prompt for this run"),
          }),
        }),
      },
      {
        id: "open_trace",
        definition: defineTool({
          description: "Open a generated trace for debugging and replay.",
          inputSchema: z.object({
            tracePath: z
              .string()
              .describe("Trace path emitted by the orchestrator"),
          }),
        }),
      },
    ],
    [],
  );

  const handlePromptSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (
      !text ||
      !props.activeSession ||
      status === "submitted" ||
      status === "streaming" ||
      props.busy
    ) {
      return;
    }

    setInput("");
    await sendMessage({ text });
  };

  return (
    <main className="flex min-w-0 flex-col bg-transparent">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="titlebar-drag-region border-border/50 flex items-center justify-between border-b glass px-4 pb-4 pt-[52px] md:px-5"
      >
        <div className="min-w-0">
          <p className="truncate font-heading text-[1.58rem] font-bold tracking-tight">
            {props.activeProject?.name ?? "No project selected"}
          </p>
          <p className="text-muted-foreground truncate text-sm">
            {props.activeSession
              ? `Session: ${props.activeSession.title}`
              : "Create a session to start chatting"}
          </p>
        </div>
        <div className="titlebar-no-drag flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              gatewayMode === "remote"
                ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                : "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
            }
          >
            {gatewayMode === "remote"
              ? `Remote${gatewayHost ? `: ${gatewayHost}` : " Gateway"}`
              : "Local Runtime"}
          </Badge>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              className="btn-glow gap-2"
              onClick={props.onOpenOnboarding}
              disabled={
                props.busy || status === "submitted" || status === "streaming"
              }
            >
              <Settings2 className="size-4" />
              Provider Setup
            </Button>
          </motion.div>
        </div>
      </motion.header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 md:px-5">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        >
          <Agent className="card-glow rounded-2xl border border-border/70 bg-[linear-gradient(180deg,hsl(221_42%_10%_/_0.86),hsl(223_40%_8%_/_0.84))] shadow-[0_18px_46px_hsl(226_80%_2%_/_0.32)]">
            <AgentHeader
              name="OpenGoat Orchestrator"
              model={
                gatewayMode === "remote" ? "remote gateway" : "local runtime"
              }
            />
            <AgentContent className="space-y-3">
              <AgentInstructions>
                Plan and execute project-scoped coding tasks, then report
                concise outputs with relevant trace metadata.
              </AgentInstructions>
              <AgentTools collapsible type="single">
                {orchestratorTools.map((entry) => (
                  <AgentTool
                    key={entry.id}
                    tool={entry.definition}
                    value={entry.id}
                  />
                ))}
              </AgentTools>
              <AgentOutput
                schema={`z.object({
  summary: z.string(),
  tracePath: z.string().optional(),
  filesChanged: z.array(z.string())
})`}
              />
            </AgentContent>
          </Agent>
        </motion.div>

        <Conversation className="min-h-0 rounded-2xl border border-border/70 bg-[color-mix(in_oklab,var(--surface)_80%,transparent)] shadow-[0_20px_54px_hsl(225_78%_3%_/_0.35)]">
          <ConversationContent className="p-4">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <ConversationEmptyState
                  title="Start your first run"
                  description="Ask OpenGoat to inspect code, write changes, or explain architecture."
                  icon={
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Sparkles className="size-6 text-primary" />
                    </motion.div>
                  }
                >
                  <div className="space-y-4 text-left">
                    <p className="text-muted-foreground text-sm">
                      Try one of these:
                    </p>
                    <Suggestions>
                      {starterPrompts.map((prompt) => (
                        <Suggestion
                          key={prompt}
                          suggestion={prompt}
                          className="transition-all duration-200 hover:scale-105 hover:shadow-[0_0_20px_hsl(162_78%_49%_/_0.2)]"
                          onClick={(value) => setInput(value)}
                        />
                      ))}
                    </Suggestions>
                  </div>
                </ConversationEmptyState>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {messages.map((message, index) => {
                  const content = getTextContent(message);
                  const metadata = message.metadata;
                  const tracePath =
                    metadata &&
                    typeof metadata === "object" &&
                    "tracePath" in metadata
                      ? String(metadata.tracePath ?? "")
                      : "";
                  const providerId =
                    metadata &&
                    typeof metadata === "object" &&
                    "providerId" in metadata
                      ? String(metadata.providerId ?? "")
                      : "";
                  const isLastAssistant =
                    message.role === "assistant" &&
                    index === messages.length - 1;
                  const isStreaming =
                    isLastAssistant &&
                    (status === "streaming" || status === "submitted");

                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3, delay: index * 0.02 }}
                      layout
                      className="space-y-2"
                    >
                      <Message from={message.role}>
                        <MessageContent
                          className={
                            message.role === "assistant"
                              ? "rounded-2xl border border-border/65 bg-[color-mix(in_oklab,var(--surface-soft)_84%,transparent)] px-4 py-3 transition-all duration-300"
                              : "rounded-2xl border border-primary/45 bg-[linear-gradient(135deg,hsl(162_80%_49%_/_0.19),hsl(162_72%_38%_/_0.16))] px-4 py-3 shadow-[0_0_20px_hsl(162_78%_49%_/_0.1)]"
                          }
                        >
                          {isStreaming && !content ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="size-4 animate-spin" />
                              <span className="text-sm">Thinking...</span>
                            </div>
                          ) : (
                            <MessageResponse>
                              {content ||
                                (message.role === "assistant"
                                  ? "No text response."
                                  : "")}
                            </MessageResponse>
                          )}
                        </MessageContent>
                      </Message>

                      {message.role === "assistant" &&
                      (tracePath || providerId) ? (
                        <div className="max-w-3xl">
                          <Reasoning className="mb-1" defaultOpen={false}>
                            <ReasoningTrigger />
                            <ReasoningContent>
                              {`Provider: ${
                                providerId || "orchestrator"
                              }\nTrace: ${tracePath || "not emitted"}`}
                            </ReasoningContent>
                          </Reasoning>

                          {isLastAssistant ? (
                            <Tool
                              className="border-border/70 bg-card/45"
                              defaultOpen={false}
                            >
                              <ToolHeader
                                type="dynamic-tool"
                                state="output-available"
                                toolName="orchestrator"
                                title="Latest execution metadata"
                              />
                              <ToolContent>
                                <ToolOutput
                                  errorText={undefined}
                                  output={{
                                    providerId: providerId || "orchestrator",
                                    tracePath: tracePath || null,
                                  }}
                                />
                              </ToolContent>
                            </Tool>
                          ) : null}
                        </div>
                      ) : null}

                      {message.role === "assistant" && content ? (
                        <MessageActions className="pl-1">
                          <MessageAction
                            tooltip="Copy response"
                            label="Copy response"
                            onClick={() => {
                              void navigator.clipboard.writeText(content);
                            }}
                          >
                            <Copy className="size-3.5" />
                          </MessageAction>
                        </MessageActions>
                      ) : null}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="border-border/50 border-t glass px-4 py-4 md:px-5"
      >
        {sourceLinks.length > 0 ? (
          <Sources className="mb-3 text-muted-foreground">
            <SourcesTrigger count={sourceLinks.length}>
              <span className="flex items-center gap-2 text-xs">
                <FolderCode className="size-3.5" />
                Workspace Context
              </span>
            </SourcesTrigger>
            <SourcesContent>
              {sourceLinks.map((source) => (
                <Source
                  key={source.href}
                  href={source.href}
                  title={source.label}
                />
              ))}
            </SourcesContent>
          </Sources>
        ) : null}

        {resolvedError ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border-destructive/35 bg-destructive/12 mb-3 flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-red-200"
          >
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
          </motion.div>
        ) : null}

        <Suggestions className="mb-3">
          {starterPrompts.map((prompt) => (
            <Suggestion
              key={prompt}
              suggestion={prompt}
              className="transition-all duration-200 hover:scale-105"
              onClick={(value) => setInput(value)}
            />
          ))}
        </Suggestions>

        <PromptInput
          className="card-glow rounded-2xl border border-border/70 bg-[color-mix(in_oklab,var(--surface)_82%,transparent)] p-1 shadow-[0_16px_36px_hsl(224_72%_2%_/_0.2)]"
          onSubmit={handlePromptSubmit}
        >
          <PromptInputBody>
            <PromptInputTextarea
              className="input-glow min-h-20 px-4"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={
                !props.activeSession ||
                props.busy ||
                status === "submitted" ||
                status === "streaming"
              }
              placeholder={
                props.activeSession
                  ? "Describe the task you want OpenGoat to run..."
                  : "Create a session first, then send a message."
              }
            />
          </PromptInputBody>
          <PromptInputFooter className="border-t border-border/55 px-3 pb-2 pt-2">
            <PromptInputTools className="min-h-8">
              <p className="text-muted-foreground truncate text-xs">
                {props.homeDir}
              </p>
            </PromptInputTools>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <PromptInputSubmit
                className="size-9 rounded-xl"
                disabled={!canSend}
                status={status}
              />
            </motion.div>
          </PromptInputFooter>
        </PromptInput>
      </motion.footer>
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
