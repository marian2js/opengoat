import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { MessagingConnectionService } from "../../messaging-connections/application/messaging-connection.service.js";
import type { MessagingRouterService } from "../../messaging-router/application/messaging-router.service.js";
import type { ChatSdkBridgeService } from "../../messaging-bridge/application/messaging-bridge.service.js";
import type {
  TelegramConnectionConfig,
  TelegramUpdate,
  TelegramSendMessageParams,
  TelegramInlineKeyboardMarkup,
} from "../domain/telegram-channel.js";
import {
  INTRODUCTION_MESSAGE,
  FOLLOW_UP_BUTTONS,
  CALLBACK_RESPONSES,
} from "../domain/telegram-channel.js";

interface TelegramChannelServiceDeps {
  connectionService: MessagingConnectionService;
  routerService: MessagingRouterService;
  bridgeService: ChatSdkBridgeService;
  paths: OpenGoatPaths;
  fetchFn?: typeof globalThis.fetch;
}

export interface WebhookResult {
  ok: boolean;
  error?: string;
}

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

export class TelegramChannelService {
  private readonly connectionService: MessagingConnectionService;
  private readonly routerService: MessagingRouterService;
  private readonly bridgeService: ChatSdkBridgeService;
  private readonly paths: OpenGoatPaths;
  private readonly fetchFn: typeof globalThis.fetch;

  public constructor(deps: TelegramChannelServiceDeps) {
    this.connectionService = deps.connectionService;
    this.routerService = deps.routerService;
    this.bridgeService = deps.bridgeService;
    this.paths = deps.paths;
    this.fetchFn = deps.fetchFn ?? globalThis.fetch;
  }

  public async handleWebhook(
    connectionId: string,
    secretToken: string,
    update: TelegramUpdate,
  ): Promise<WebhookResult> {
    // Load and validate connection
    const connection = await this.connectionService.get(this.paths, connectionId);
    if (!connection) {
      return { ok: false, error: `Connection "${connectionId}" not found.` };
    }
    if (connection.status !== "connected") {
      return {
        ok: false,
        error: `Connection "${connectionId}" is not connected (status: ${connection.status}).`,
      };
    }

    // Validate secret token
    const config = this.parseConfig(connection.configRef);
    if (!config || config.secretToken !== secretToken) {
      return { ok: false, error: "Invalid secret token." };
    }

    // Handle callback query (inline button press)
    if (update.callback_query) {
      return this.handleCallbackQuery(connectionId, config.botToken, update);
    }

    // Handle text message
    if (update.message?.text) {
      return this.handleTextMessage(connectionId, config.botToken, update);
    }

    // Ignore other update types
    return { ok: true };
  }

  private async handleTextMessage(
    connectionId: string,
    botToken: string,
    update: TelegramUpdate,
  ): Promise<WebhookResult> {
    const message = update.message!;
    const chatId = message.chat.id;
    const externalThreadId = `tg:${chatId}`;
    const senderName = message.from?.first_name;

    // Check if this is a new thread for first-contact intro
    const threadResult = await this.routerService.resolveThread(
      this.paths,
      connectionId,
      externalThreadId,
    );

    if (threadResult.isNew) {
      const introText = INTRODUCTION_MESSAGE.replace(
        "{projectName}",
        "your project",
      );
      await this.sendTelegramMessage(botToken, {
        chat_id: chatId,
        text: introText,
        parse_mode: "Markdown",
      });
    }

    // Route through bridge service
    const result = await this.bridgeService.handleInboundMessage(this.paths, {
      connectionId,
      externalThreadId,
      senderName,
      text: message.text!,
      timestamp: new Date(message.date * 1000).toISOString(),
    });

    // Send response with follow-up buttons
    await this.sendTelegramMessage(botToken, {
      chat_id: chatId,
      text: result.text,
      parse_mode: "Markdown",
      reply_markup: FOLLOW_UP_BUTTONS,
    });

    return { ok: true };
  }

  private async handleCallbackQuery(
    connectionId: string,
    botToken: string,
    update: TelegramUpdate,
  ): Promise<WebhookResult> {
    const callback = update.callback_query!;
    const chatId = callback.message?.chat.id;
    const action = callback.data;

    // Answer the callback query to remove loading state
    await this.callTelegramApi(botToken, "answerCallbackQuery", {
      callback_query_id: callback.id,
    });

    if (!chatId || !action) {
      return { ok: true };
    }

    const responseText = CALLBACK_RESPONSES[action];
    if (!responseText) {
      return { ok: true };
    }

    const externalThreadId = `tg:${chatId}`;

    // Route callback action through bridge as a follow-up message
    const result = await this.bridgeService.handleInboundMessage(this.paths, {
      connectionId,
      externalThreadId,
      senderName: callback.from.first_name,
      text: responseText,
      timestamp: new Date().toISOString(),
    });

    // Send the agent response with follow-up buttons
    const replyMarkup: TelegramInlineKeyboardMarkup | undefined =
      action === "more" ? undefined : FOLLOW_UP_BUTTONS;

    await this.sendTelegramMessage(botToken, {
      chat_id: chatId,
      text: result.text,
      parse_mode: "Markdown",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });

    return { ok: true };
  }

  private async sendTelegramMessage(
    botToken: string,
    params: TelegramSendMessageParams,
  ): Promise<void> {
    await this.callTelegramApi(botToken, "sendMessage", params as unknown as Record<string, unknown>);
  }

  private async callTelegramApi(
    botToken: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const url = `${TELEGRAM_API_BASE}${botToken}/${method}`;
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return response.json();
  }

  private parseConfig(
    configRef: string | null,
  ): TelegramConnectionConfig | undefined {
    if (!configRef) {
      return undefined;
    }
    try {
      return JSON.parse(configRef) as TelegramConnectionConfig;
    } catch {
      return undefined;
    }
  }
}
