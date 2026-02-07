import {
  createUIMessageStream,
  type ChatTransport,
  type TextUIPart,
  type UIMessage
} from "ai";
import type { WorkbenchMessage } from "@shared/workbench";

export interface ElectronUiMessageMetadata {
  createdAt?: string;
  tracePath?: string;
  providerId?: string;
}

export type ElectronUiMessage = UIMessage<ElectronUiMessageMetadata>;

interface ElectronChatTransportDeps {
  submitMessage: (message: string) => Promise<WorkbenchMessage | null>;
}

export function createElectronChatTransport(
  deps: ElectronChatTransportDeps
): ChatTransport<ElectronUiMessage> {
  return {
    sendMessages: async ({ messages, abortSignal }) => {
      if (abortSignal?.aborted) {
        throw new Error("Request aborted.");
      }

      const message = getLastUserText(messages);
      if (!message) {
        throw new Error("Cannot send an empty message.");
      }

      const reply = await deps.submitMessage(message);
      if (!reply) {
        throw new Error("No response was returned.");
      }

      const metadata = buildMetadata(reply);
      const textPartId = `${reply.id}-text`;

      return createUIMessageStream<ElectronUiMessage>({
        originalMessages: messages,
        execute: ({ writer }) => {
          writer.write({ type: "start", messageId: reply.id, messageMetadata: metadata });
          writer.write({ type: "text-start", id: textPartId });
          writer.write({ type: "text-delta", id: textPartId, delta: reply.content });
          writer.write({ type: "text-end", id: textPartId });
          writer.write({ type: "finish", messageMetadata: metadata, finishReason: "stop" });
        }
      });
    },
    reconnectToStream: async () => null
  };
}

export function toElectronUiMessages(messages: WorkbenchMessage[]): ElectronUiMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    metadata: buildMetadata(message),
    parts: [
      {
        type: "text",
        text: message.content,
        state: "done"
      } satisfies TextUIPart
    ]
  }));
}

export function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((part): part is TextUIPart => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

function getLastUserText(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate || candidate.role !== "user") {
      continue;
    }
    const content = getTextContent(candidate);
    if (content) {
      return content;
    }
  }
  return "";
}

function buildMetadata(message: WorkbenchMessage): ElectronUiMessageMetadata | undefined {
  const metadata: ElectronUiMessageMetadata = {
    createdAt: message.createdAt,
    tracePath: message.tracePath,
    providerId: message.providerId
  };

  const hasData = Boolean(
    metadata.createdAt || metadata.tracePath || metadata.providerId
  );
  return hasData ? metadata : undefined;
}
