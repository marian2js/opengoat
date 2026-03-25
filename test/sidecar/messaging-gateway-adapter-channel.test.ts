import { describe, expect, it, vi } from "vitest";
import { MessagingGatewayAdapter } from "../../packages/sidecar/src/internal-gateway/messaging-gateway-adapter.js";
import type { EmbeddedGatewayClient } from "../../packages/sidecar/src/internal-gateway/gateway-client.js";

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

const STREAM_RESPONSE = [
  '0:{"messageId":"msg-1","type":"start"}\n',
  '0:{"id":"p1","type":"text-start"}\n',
  '0:{"id":"p1","type":"text-delta","delta":"OK"}\n',
  '0:{"id":"p1","type":"text-end"}\n',
  '0:{"type":"finish","finishReason":"stop"}\n',
];

describe("MessagingGatewayAdapter – channel prompt injection", () => {
  it("prepends channel prompt when channelType is telegram", async () => {
    const mockGateway = {
      streamConversation: vi.fn().mockResolvedValue(
        new Response(createMockStream(STREAM_RESPONSE), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    } as unknown as EmbeddedGatewayClient;

    const adapter = new MessagingGatewayAdapter(mockGateway);
    await adapter.sendMessage("proj-1", "thread-1", "Help me", "telegram");

    const call = (mockGateway.streamConversation as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    const textPart = call.message.parts[0];
    expect(textPart.text).toContain("<channel-instructions>");
    expect(textPart.text).toContain("Telegram");
    expect(textPart.text).toContain("Help me");
  });

  it("prepends channel prompt when channelType is whatsapp", async () => {
    const mockGateway = {
      streamConversation: vi.fn().mockResolvedValue(
        new Response(createMockStream(STREAM_RESPONSE), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    } as unknown as EmbeddedGatewayClient;

    const adapter = new MessagingGatewayAdapter(mockGateway);
    await adapter.sendMessage("proj-1", "thread-1", "Help me", "whatsapp");

    const call = (mockGateway.streamConversation as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    const textPart = call.message.parts[0];
    expect(textPart.text).toContain("<channel-instructions>");
    expect(textPart.text).toContain("WhatsApp");
    expect(textPart.text).toContain("Help me");
  });

  it("does NOT prepend channel prompt when channelType is undefined", async () => {
    const mockGateway = {
      streamConversation: vi.fn().mockResolvedValue(
        new Response(createMockStream(STREAM_RESPONSE), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    } as unknown as EmbeddedGatewayClient;

    const adapter = new MessagingGatewayAdapter(mockGateway);
    await adapter.sendMessage("proj-1", "thread-1", "Help me");

    const call = (mockGateway.streamConversation as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    const textPart = call.message.parts[0];
    expect(textPart.text).toBe("Help me");
    expect(textPart.text).not.toContain("<channel-instructions>");
  });

  it("does NOT prepend channel prompt when channelType is desktop", async () => {
    const mockGateway = {
      streamConversation: vi.fn().mockResolvedValue(
        new Response(createMockStream(STREAM_RESPONSE), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    } as unknown as EmbeddedGatewayClient;

    const adapter = new MessagingGatewayAdapter(mockGateway);
    await adapter.sendMessage("proj-1", "thread-1", "Help me", "desktop");

    const call = (mockGateway.streamConversation as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    const textPart = call.message.parts[0];
    expect(textPart.text).toContain("<channel-instructions>");
    expect(textPart.text).toContain("desktop");
  });
});
