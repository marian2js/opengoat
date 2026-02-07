import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { tool as defineTool } from "ai";
import { z } from "zod";
import { Button } from "@renderer/components/ui/button";
import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentOutput,
  AgentTool,
  AgentTools
} from "@renderer/components/ai-elements/agent";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton
} from "@renderer/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse
} from "@renderer/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools
} from "@renderer/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger
} from "@renderer/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger
} from "@renderer/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@renderer/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput
} from "@renderer/components/ai-elements/tool";
import type { WorkbenchMessage, WorkbenchProject, WorkbenchSession } from "@shared/workbench";
import {
  createElectronChatTransport,
  getTextContent,
  toElectronUiMessages,
  type ElectronUiMessage
} from "./electron-chat-transport";
import {
  Copy,
  FolderCode,
  Settings2,
  Sparkles
} from "lucide-react";

interface ChatPanelProps {
  homeDir: string;
  activeProject: WorkbenchProject | null;
  activeSession: WorkbenchSession | null;
  messages: WorkbenchMessage[];
  error: string | null;
  busy: boolean;
  onSubmitMessage: (message: string) => Promise<WorkbenchMessage | null>;
  onOpenOnboarding: () => void;
  onDismissError: () => void;
}

const starterPrompts = [
  "Summarize this project architecture.",
  "Find risky code paths and explain why.",
  "Propose the next three engineering tasks."
];

export function ChatPanel(props: ChatPanelProps) {
  const chatId = `${props.activeProject?.id ?? "none"}:${props.activeSession?.id ?? "none"}`;
  const initialMessages = useMemo(
    () => toElectronUiMessages(props.messages),
    [props.messages]
  );
  const transport = useMemo(
    () =>
      createElectronChatTransport({
        submitMessage: async (message: string) =>
          props.onSubmitMessage(message)
      }),
    [props.onSubmitMessage]
  );
  const {
    messages,
    sendMessage,
    setMessages,
    clearError,
    status,
    error: chatError
  } = useChat<ElectronUiMessage>({
    id: chatId,
    messages: initialMessages,
    transport
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
      !props.busy
  );
  const resolvedError = chatError?.message ?? props.error;
  const sourceLinks = useMemo(() => {
    const links: Array<{ href: string; label: string }> = [];
    if (props.activeProject?.rootPath) {
      links.push({
        href: encodeURI(`file://${props.activeProject.rootPath}`),
        label: props.activeProject.rootPath
      });
    }
    if (props.homeDir) {
      links.push({
        href: encodeURI(`file://${props.homeDir}`),
        label: props.homeDir
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
            projectPath: z.string().describe("Absolute path to the selected project"),
            focus: z.string().optional().describe("Optional area to focus on")
          })
        })
      },
      {
        id: "run_session",
        definition: defineTool({
          description: "Run an orchestrated session step and stream results.",
          inputSchema: z.object({
            sessionId: z.string().describe("Current session identifier"),
            prompt: z.string().describe("User prompt for this run")
          })
        })
      },
      {
        id: "open_trace",
        definition: defineTool({
          description: "Open a generated trace for debugging and replay.",
          inputSchema: z.object({
            tracePath: z.string().describe("Trace path emitted by the orchestrator")
          })
        })
      }
    ],
    []
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
    <main className="flex min-w-0 flex-col bg-background/10">
      <header className="border-border/60 flex items-center justify-between border-b bg-background/55 px-5 py-4 backdrop-blur-md">
        <div className="min-w-0">
          <p className="truncate font-heading text-xl font-semibold tracking-tight">
            {props.activeProject?.name ?? "No project selected"}
          </p>
          <p className="text-muted-foreground truncate text-sm">
            {props.activeSession
              ? `Session: ${props.activeSession.title}`
              : "Create a session to start chatting"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={props.onOpenOnboarding}
          disabled={props.busy || status === "submitted" || status === "streaming"}
        >
          <Settings2 className="size-4" />
          Provider Setup
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
        <Agent className="border-border/70 bg-card/45">
          <AgentHeader name="OpenGoat Orchestrator" model="local runtime" />
          <AgentContent className="space-y-3">
            <AgentInstructions>
              Plan and execute project-scoped coding tasks, then report concise outputs with relevant trace metadata.
            </AgentInstructions>
            <AgentTools collapsible type="single">
              {orchestratorTools.map((entry) => (
                <AgentTool key={entry.id} tool={entry.definition} value={entry.id} />
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

        <Conversation className="min-h-0 rounded-xl border border-border/70 bg-card/35 shadow-[0_18px_60px_hsl(218_43%_5%_/_0.45)]">
          <ConversationContent className="p-4">
            {messages.length === 0 ? (
              <ConversationEmptyState
                title="Start your first run"
                description="Ask OpenGoat to inspect code, write changes, or explain architecture."
                icon={<Sparkles className="size-5" />}
              >
                <div className="space-y-3 text-left">
                  <p className="text-muted-foreground text-sm">Try one of these:</p>
                  <Suggestions>
                    {starterPrompts.map((prompt) => (
                      <Suggestion
                        key={prompt}
                        suggestion={prompt}
                        onClick={(value) => setInput(value)}
                      />
                    ))}
                  </Suggestions>
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((message, index) => {
                const content = getTextContent(message);
                const metadata = message.metadata;
                const tracePath =
                  metadata && typeof metadata === "object" && "tracePath" in metadata
                    ? String(metadata.tracePath ?? "")
                    : "";
                const providerId =
                  metadata && typeof metadata === "object" && "providerId" in metadata
                    ? String(metadata.providerId ?? "")
                    : "";
                const isLastAssistant =
                  message.role === "assistant" && index === messages.length - 1;

                return (
                  <div key={message.id} className="space-y-2">
                    <Message from={message.role}>
                      <MessageContent
                        className={
                          message.role === "assistant"
                            ? "rounded-2xl border border-border/70 bg-card/70 px-4 py-3"
                            : "rounded-2xl border border-primary/55 bg-primary/15 px-4 py-3"
                        }
                      >
                        <MessageResponse>
                          {content || (message.role === "assistant" ? "No text response." : "")}
                        </MessageResponse>
                      </MessageContent>
                    </Message>

                    {message.role === "assistant" && (tracePath || providerId) ? (
                      <div className="max-w-3xl">
                        <Reasoning className="mb-1" defaultOpen={false}>
                          <ReasoningTrigger />
                          <ReasoningContent>
                            {`Provider: ${providerId || "orchestrator"}\nTrace: ${tracePath || "not emitted"}`}
                          </ReasoningContent>
                        </Reasoning>

                        {isLastAssistant ? (
                          <Tool className="border-border/70 bg-card/45" defaultOpen={false}>
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
                                  tracePath: tracePath || null
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
                  </div>
                );
              })
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      <footer className="border-border/60 border-t bg-background/55 px-5 py-4 backdrop-blur-md">
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
                <Source key={source.href} href={source.href} title={source.label} />
              ))}
            </SourcesContent>
          </Sources>
        ) : null}

        {resolvedError ? (
          <div className="border-destructive/35 bg-destructive/10 mb-3 flex items-center justify-between rounded-md border px-3 py-2 text-sm text-red-200">
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

        <Suggestions className="mb-3">
          {starterPrompts.map((prompt) => (
            <Suggestion key={prompt} suggestion={prompt} onClick={(value) => setInput(value)} />
          ))}
        </Suggestions>

        <PromptInput onSubmit={handlePromptSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
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
          <PromptInputFooter>
            <PromptInputTools>
              <p className="text-muted-foreground truncate text-xs">{props.homeDir}</p>
            </PromptInputTools>
            <PromptInputSubmit disabled={!canSend} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </footer>
    </main>
  );
}
