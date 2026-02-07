import { describe, expect, it, vi } from "vitest";
import { readUIMessageStream, type UIMessage } from "ai";
import {
  createElectronChatTransport,
  getTextContent,
  toElectronUiMessages
} from "./electron-chat-transport";

describe("electron chat transport", () => {
  it("streams a persisted assistant message as UI message chunks", async () => {
    const submitMessage = vi.fn(async () => ({
      id: "assistant-1",
      role: "assistant" as const,
      content: "Hello from OpenGoat.",
      createdAt: "2026-02-07T00:00:00.000Z",
      tracePath: "/tmp/trace.json",
      providerId: "openai"
    }));
    const transport = createElectronChatTransport({ submitMessage });

    const stream = await transport.sendMessages({
      trigger: "submit-message",
      chatId: "chat-1",
      messageId: undefined,
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Say hello" }]
        }
      ],
      abortSignal: undefined
    });

    const updates: UIMessage[] = [];
    for await (const message of readUIMessageStream({ stream })) {
      updates.push(message);
    }

    const finalMessage = updates.at(-1);
    expect(submitMessage).toHaveBeenCalledWith("Say hello");
    expect(finalMessage?.id).toBe("assistant-1");
    expect(finalMessage?.role).toBe("assistant");
    expect(getTextContent(finalMessage as UIMessage)).toBe("Hello from OpenGoat.");
    const metadata = finalMessage?.metadata as
      | { tracePath?: string; providerId?: string }
      | undefined;
    expect(metadata?.tracePath).toBe("/tmp/trace.json");
    expect(metadata?.providerId).toBe("openai");
  });

  it("maps persisted workbench messages into UI messages", () => {
    const messages = toElectronUiMessages([
      {
        id: "m1",
        role: "assistant",
        content: "Persisted response",
        createdAt: "2026-02-07T00:00:00.000Z",
        tracePath: "/tmp/run.json",
        providerId: "openai"
      }
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe("assistant");
    expect(getTextContent(messages[0] as UIMessage)).toBe("Persisted response");
    const metadata = messages[0]?.metadata as
      | { tracePath?: string; providerId?: string }
      | undefined;
    expect(metadata?.tracePath).toBe("/tmp/run.json");
    expect(metadata?.providerId).toBe("openai");
  });
});
