import { describe, expect, it, vi } from "vitest";
import { readUIMessageStream, type UIMessage } from "ai";
import type { WorkbenchMessage } from "@shared/workbench";
import {
  createElectronChatTransport,
  getImageInputs,
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
    expect(submitMessage).toHaveBeenCalledWith({
      message: "Say hello",
      images: []
    });
    expect(finalMessage?.id).toBe("assistant-1");
    expect(finalMessage?.role).toBe("assistant");
    expect(getTextContent(finalMessage as UIMessage)).toBe("Hello from OpenGoat.");
    const metadata = finalMessage?.metadata as
      | { tracePath?: string; providerId?: string }
      | undefined;
    expect(metadata?.tracePath).toBe("/tmp/trace.json");
    expect(metadata?.providerId).toBe("openai");
  });

  it("aborts the UI request when the chat request is aborted", async () => {
    let resolveMessage: ((value: WorkbenchMessage) => void) | undefined;
    const submitMessage = vi.fn(
      () =>
        new Promise<WorkbenchMessage>((resolve) => {
          resolveMessage = resolve;
        })
    );
    const transport = createElectronChatTransport({ submitMessage });
    const abortController = new AbortController();

    const streamPromise = transport.sendMessages({
      trigger: "submit-message",
      chatId: "chat-1",
      messageId: undefined,
      messages: [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Stop this run" }]
        }
      ],
      abortSignal: abortController.signal
    });

    abortController.abort();
    await expect(streamPromise).rejects.toMatchObject({ name: "AbortError" });

    resolveMessage?.({
      id: "assistant-1",
      role: "assistant",
      content: "late reply",
      createdAt: "2026-02-07T00:00:00.000Z"
    });
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

  it("extracts image inputs from user file parts", () => {
    const message: UIMessage = {
      id: "user-1",
      role: "user",
      parts: [
        { type: "text", text: "Describe this" },
        {
          type: "file",
          filename: "chart.png",
          mediaType: "image/png",
          url: "data:image/png;base64,aGVsbG8="
        }
      ]
    };

    expect(getImageInputs(message)).toEqual([
      {
        dataUrl: "data:image/png;base64,aGVsbG8=",
        mediaType: "image/png",
        name: "chart.png"
      }
    ]);
  });
});
