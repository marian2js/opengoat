import { describe, expect, it, vi } from "vitest";
import { MessagingGatewayAdapter } from "../packages/sidecar/src/internal-gateway/messaging-gateway-adapter.js";
import type { EmbeddedGatewayClient } from "../packages/sidecar/src/internal-gateway/gateway-client.js";

function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe("MessagingGatewayAdapter", () => {
  it("sends message through gateway and returns collected response text", async () => {
    // Simulate a streaming response with text-delta events
    const streamContent = [
      '0:{"messageId":"msg-1","type":"start"}\n',
      '0:{"id":"part-1","type":"text-start"}\n',
      '0:{"id":"part-1","type":"text-delta","delta":"Hello "}\n',
      '0:{"id":"part-1","type":"text-delta","delta":"from OpenGoat!"}\n',
      '0:{"id":"part-1","type":"text-end"}\n',
      '0:{"type":"finish","finishReason":"stop"}\n',
    ];

    const mockGateway = {
      streamConversation: vi.fn().mockResolvedValue(
        new Response(createMockStream(streamContent), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    } as unknown as EmbeddedGatewayClient;

    const adapter = new MessagingGatewayAdapter(mockGateway);
    const result = await adapter.sendMessage("proj-1", "thread-1", "Help me");

    expect(result).toBe("Hello from OpenGoat!");
    expect(mockGateway.streamConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          parts: [{ type: "text", text: "Help me" }],
          role: "user",
        }),
      }),
    );
  });

  it("passes correct projectId and chatThreadId as session context", async () => {
    const mockGateway = {
      streamConversation: vi.fn().mockResolvedValue(
        new Response(createMockStream([
          '0:{"messageId":"msg-1","type":"start"}\n',
          '0:{"id":"p1","type":"text-start"}\n',
          '0:{"id":"p1","type":"text-delta","delta":"OK"}\n',
          '0:{"id":"p1","type":"text-end"}\n',
          '0:{"type":"finish","finishReason":"stop"}\n',
        ]), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    } as unknown as EmbeddedGatewayClient;

    const adapter = new MessagingGatewayAdapter(mockGateway);
    await adapter.sendMessage("proj-42", "thread-99", "Test message");

    expect(mockGateway.streamConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "thread-99",
      }),
    );
  });

  it("handles gateway errors gracefully", async () => {
    const mockGateway = {
      streamConversation: vi.fn().mockRejectedValue(new Error("Gateway unavailable")),
    } as unknown as EmbeddedGatewayClient;

    const adapter = new MessagingGatewayAdapter(mockGateway);
    await expect(
      adapter.sendMessage("proj-1", "thread-1", "Test"),
    ).rejects.toThrow("Gateway unavailable");
  });
});
