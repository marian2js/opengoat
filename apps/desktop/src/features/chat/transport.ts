import {
  DefaultChatTransport,
  type ChatTransport,
  type UIMessageChunk,
} from "ai";
import type { ChatActivity } from "@opengoat/contracts";
import type { SidecarClient } from "@/lib/sidecar/client";
import type { ChatUIMessage } from "./message-parts";

interface ChatScopeForTransport {
  type: "objective" | "run";
  objectiveId: string;
  runId?: string | undefined;
}

interface CreateChatTransportParams {
  agentId: string;
  client: SidecarClient | null;
  getScope?: () => ChatScopeForTransport | null;
  specialistId?: string | undefined;
  sessionId: string;
}

interface TauriChatStreamChunkEvent {
  chunk: UIMessageChunk<unknown, { activity: ChatActivity }>;
  type: "chunk";
}

interface TauriChatStreamDoneEvent {
  type: "done";
}

interface TauriChatStreamErrorEvent {
  message: string;
  type: "error";
}

type TauriChatStreamEvent =
  | TauriChatStreamChunkEvent
  | TauriChatStreamDoneEvent
  | TauriChatStreamErrorEvent;

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function createBrowserTransport(
  params: CreateChatTransportParams,
): ChatTransport<ChatUIMessage> {
  return new DefaultChatTransport({
    api: params.client?.createApiUrl("/chat") ?? "/chat",
    ...(params.client ? { headers: params.client.createAuthHeaders() } : {}),
    prepareSendMessagesRequest({ messages }) {
      const latestMessage = messages[messages.length - 1];
      const scope = params.getScope?.();

      return {
        body: {
          agentId: params.agentId,
          ...(latestMessage ? { message: latestMessage } : {}),
          ...(scope ? { scope } : {}),
          ...(params.specialistId ? { specialistId: params.specialistId } : {}),
          sessionId: params.sessionId,
        },
      };
    },
  });
}

function createDesktopTransport(
  params: CreateChatTransportParams,
): ChatTransport<ChatUIMessage> {
  return {
    reconnectToStream() {
      return Promise.resolve(null);
    },
    async sendMessages({ messages }) {
      const latestMessage = messages[messages.length - 1];
      if (!latestMessage) {
        throw new Error("Chat message cannot be empty.");
      }

      const [{ Channel, invoke }] = await Promise.all([import("@tauri-apps/api/core")]);

      return new ReadableStream<UIMessageChunk<unknown, { activity: ChatActivity }>>({
        start(controller) {
          const events = new Channel<TauriChatStreamEvent>();
          let closed = false;

          events.onmessage = (event) => {
            if (closed) {
              return;
            }

            if (event.type === "chunk") {
              controller.enqueue(event.chunk);
              return;
            }

            if (event.type === "error") {
              closed = true;
              controller.error(new Error(event.message));
              return;
            }

            closed = true;
            controller.close();
          };

          const scope = params.getScope?.();
          void invoke("stream_chat", {
            events,
            payload: {
              agentId: params.agentId,
              message: latestMessage,
              ...(scope ? { scope } : {}),
              ...(params.specialistId ? { specialistId: params.specialistId } : {}),
              sessionId: params.sessionId,
            },
          }).catch((error: unknown) => {
            if (closed) {
              return;
            }

            closed = true;
            controller.error(
              error instanceof Error ? error : new Error(String(error)),
            );
          });
        },
      });
    },
  };
}

export function createChatTransport(
  params: CreateChatTransportParams,
): ChatTransport<ChatUIMessage> {
  if (isTauriRuntime()) {
    return createDesktopTransport(params);
  }

  return createBrowserTransport(params);
}
