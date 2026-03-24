import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { MessagingConnectionService } from "../../messaging-connections/application/messaging-connection.service.js";
import type { MessagingRouterService } from "../../messaging-router/application/messaging-router.service.js";
import type { ChatSdkBridgeService } from "../../messaging-bridge/application/messaging-bridge.service.js";

export interface TelegramConnectionConfig {
  botToken: string;
  secretToken: string;
  webhookUrl?: string;
}

export interface TelegramChannelDeps {
  connectionService: MessagingConnectionService;
  routerService: MessagingRouterService;
  bridgeService: ChatSdkBridgeService;
  paths: OpenGoatPaths;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramSendMessageParams {
  chat_id: number;
  text: string;
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export const INTRODUCTION_MESSAGE =
  "Hi, I'm your OpenGoat CMO assistant for {projectName}. I can help with homepage copy, Product Hunt launches, SEO, outbound emails, content ideas, and marketing drafts. What would you like to work on?";

export const FOLLOW_UP_BUTTONS: TelegramInlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: "Continue", callback_data: "continue" },
      { text: "Save to Board", callback_data: "save_board" },
      { text: "More options", callback_data: "more" },
    ],
  ],
};

export const CALLBACK_RESPONSES: Record<string, string> = {
  continue: "What would you like to do next?",
  save_board: "Save this to Board",
  more: "Here are more options:\n• Refine the last output\n• Start a new task\n• View saved work\n\nWhat would you like?",
};
