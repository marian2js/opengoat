import type { ChannelType } from "../../channel-prompts/channel-prompt.js";

export interface InboundMessageEvent {
  connectionId: string;
  externalThreadId: string;
  senderName?: string;
  text: string;
  timestamp: string;
  channelType?: ChannelType;
}

export interface OutboundMessageResult {
  externalThreadId: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayPort {
  sendMessage(
    projectId: string,
    chatThreadId: string,
    message: string,
    channelType?: ChannelType,
  ): Promise<string>;
}
