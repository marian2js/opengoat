import { randomUUID } from "node:crypto";
import type { GatewayPort } from "@opengoat/core";
import { getChannelPrompt, type ChannelType } from "@opengoat/core";
import type { EmbeddedGatewayClient } from "./gateway-client.ts";

export class MessagingGatewayAdapter implements GatewayPort {
  private readonly gateway: EmbeddedGatewayClient;

  public constructor(gateway: EmbeddedGatewayClient) {
    this.gateway = gateway;
  }

  public async sendMessage(
    _projectId: string,
    chatThreadId: string,
    message: string,
    channelType?: ChannelType,
  ): Promise<string> {
    let text = message;
    if (channelType) {
      const channelPrompt = getChannelPrompt(channelType);
      text = `${channelPrompt}\n\n${message}`;
    }

    const response = await this.gateway.streamConversation({
      message: {
        id: randomUUID(),
        parts: [{ type: "text" as const, text }],
        role: "user" as const,
        createdAt: new Date(),
      },
      sessionId: chatThreadId,
    });

    return this.collectStreamText(response);
  }

  private async collectStreamText(response: Response): Promise<string> {
    const body = response.body;
    if (!body) {
      return "";
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let text = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          // Parse the stream format: "0:{json}" or similar prefixed lines
          const jsonMatch = line.match(/^\d+:(.*)/);
          if (!jsonMatch?.[1]) continue;

          try {
            const event = JSON.parse(jsonMatch[1]) as {
              type: string;
              delta?: string;
            };
            if (event.type === "text-delta" && event.delta) {
              text += event.delta;
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return text;
  }
}
