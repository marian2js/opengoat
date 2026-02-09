import type {
  ChatTransport,
  FileUIPart,
  TextUIPart,
  UIMessage,
  UIMessageChunk
} from "ai";
import type { WorkbenchImageInput, WorkbenchMessage, WorkbenchMessageImage } from "@shared/workbench";

export interface ElectronUiMessageMetadata {
  createdAt?: string;
  tracePath?: string;
  providerId?: string;
  images?: WorkbenchMessageImage[];
}

export type ElectronUiMessage = UIMessage<ElectronUiMessageMetadata>;

interface ElectronChatTransportDeps {
  submitMessage: (input: {
    message: string;
    images: WorkbenchImageInput[];
  }) => Promise<WorkbenchMessage | null>;
  stopMessage?: () => Promise<void> | void;
}

export function createElectronChatTransport(
  deps: ElectronChatTransportDeps
): ChatTransport<ElectronUiMessage> {
  return {
    sendMessages: async ({ messages, abortSignal }) => {
      if (abortSignal?.aborted) {
        throw createAbortError();
      }

      const input = getLastUserInput(messages);
      if (!input) {
        throw new Error("Cannot send an empty message.");
      }

      let abortListener: (() => void) | undefined;
      const abortPromise = new Promise<never>((_, reject) => {
        if (!abortSignal) {
          return;
        }
        abortListener = () => {
          void Promise.resolve(deps.stopMessage?.()).catch(() => undefined);
          reject(createAbortError());
        };
        abortSignal.addEventListener("abort", abortListener, { once: true });
      });

      let reply: WorkbenchMessage | null;
      try {
        reply = abortSignal
          ? await Promise.race([deps.submitMessage(input), abortPromise])
          : await deps.submitMessage(input);
      } finally {
        if (abortSignal && abortListener) {
          abortSignal.removeEventListener("abort", abortListener);
        }
      }

      if (!reply) {
        throw new Error("No response was returned.");
      }

      const metadata = buildMetadata(reply);
      const textPartId = `${reply.id}-text`;

      return createSingleReplyStream([
        { type: "start", messageId: reply.id, messageMetadata: metadata },
        { type: "text-start", id: textPartId },
        { type: "text-delta", id: textPartId, delta: reply.content },
        { type: "text-end", id: textPartId },
        { type: "finish", messageMetadata: metadata, finishReason: "stop" }
      ]);
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

function getLastUserInput(messages: UIMessage[]): {
  message: string;
  images: WorkbenchImageInput[];
} | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate || candidate.role !== "user") {
      continue;
    }
    const text = getTextContent(candidate);
    const images = getImageInputs(candidate);
    const message = text || (images.length > 0 ? "Please analyze the attached image(s)." : "");
    if (message) {
      return {
        message,
        images
      };
    }
  }
  return null;
}

export function getImageInputs(message: UIMessage): WorkbenchImageInput[] {
  const parts = message.parts.filter((part): part is FileUIPart => part.type === "file");
  return parts
    .map((part) => {
      const url = part.url?.trim();
      if (!url) {
        return null;
      }
      const mediaType = part.mediaType?.trim() || undefined;
      if (mediaType && !mediaType.startsWith("image/")) {
        return null;
      }

      if (url.startsWith("data:")) {
        return {
          dataUrl: url,
          mediaType,
          name: part.filename?.trim() || undefined
        };
      }

      if (url.startsWith("blob:")) {
        return null;
      }

      return {
        path: url,
        mediaType,
        name: part.filename?.trim() || undefined
      };
    })
    .filter((entry): entry is WorkbenchImageInput => Boolean(entry));
}

function buildMetadata(message: WorkbenchMessage): ElectronUiMessageMetadata | undefined {
  const metadata: ElectronUiMessageMetadata = {
    createdAt: message.createdAt,
    tracePath: message.tracePath,
    providerId: message.providerId,
    images: message.images
  };

  const hasData = Boolean(
    metadata.createdAt || metadata.tracePath || metadata.providerId || metadata.images?.length
  );
  return hasData ? metadata : undefined;
}

function createSingleReplyStream(
  chunks: UIMessageChunk<ElectronUiMessageMetadata>[]
): ReadableStream<UIMessageChunk<ElectronUiMessageMetadata>> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    }
  });
}

function createAbortError(): Error {
  const error = new Error("Request aborted.");
  error.name = "AbortError";
  return error;
}
