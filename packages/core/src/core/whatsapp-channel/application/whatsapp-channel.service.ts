import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { MessagingConnectionService } from "../../messaging-connections/application/messaging-connection.service.js";
import type { MessagingRouterService } from "../../messaging-router/application/messaging-router.service.js";
import type { ChatSdkBridgeService } from "../../messaging-bridge/application/messaging-bridge.service.js";
import type {
  WhatsAppChannelDeps,
  WhatsAppConnectionConfig,
  WhatsAppSessionEvent,
  BaileysSocket,
  MakeSocketFn,
  InitAuthStateFn,
} from "../domain/whatsapp-channel.js";
import {
  WHATSAPP_INTRODUCTION_MESSAGE,
  FATAL_DISCONNECT_CODES,
  WHATSAPP_DISCONNECT_REASONS,
} from "../domain/whatsapp-channel.js";
import { chunkMessage, formatForWhatsApp } from "./whatsapp-format-converter.js";

interface ActiveSession {
  socket: BaileysSocket;
  connectionId: string;
}

// Minimal shape for Baileys WAMessage key
interface WAMessageKey {
  remoteJid?: string;
  fromMe?: boolean;
  id?: string;
}

// Minimal shape for a Baileys WAMessage
interface WAMessage {
  key: WAMessageKey;
  message?: Record<string, unknown>;
  messageTimestamp?: number;
}

export class WhatsAppChannelService {
  private readonly connectionService: MessagingConnectionService;
  private readonly routerService: MessagingRouterService;
  private readonly bridgeService: ChatSdkBridgeService;
  private readonly paths: OpenGoatPaths;
  private readonly qrToDataUrlFn: (text: string) => Promise<string>;
  private readonly makeSocketFn: MakeSocketFn;
  private readonly initAuthStateFn: InitAuthStateFn;
  private readonly activeSessions = new Map<string, ActiveSession>();

  public constructor(
    deps: WhatsAppChannelDeps & {
      makeSocketFn?: MakeSocketFn;
      initAuthStateFn?: InitAuthStateFn;
    },
  ) {
    this.connectionService = deps.connectionService;
    this.routerService = deps.routerService;
    this.bridgeService = deps.bridgeService;
    this.paths = deps.paths;
    this.qrToDataUrlFn =
      deps.qrToDataUrlFn ?? (async (text: string) => `data:text/plain,${text}`);
    this.makeSocketFn =
      deps.makeSocketFn ??
      (() => {
        throw new Error(
          "makeSocketFn not provided — Baileys must be wired at the sidecar level.",
        );
      });
    this.initAuthStateFn =
      deps.initAuthStateFn ??
      (async () => {
        throw new Error(
          "initAuthStateFn not provided — Baileys must be wired at the sidecar level.",
        );
      });
  }

  /**
   * Start a WhatsApp session for the given connection.
   * Returns an async generator that yields QR code events and status updates.
   * The generator completes when the session connects or encounters a fatal error.
   * The socket continues running in the background for message handling.
   */
  public async *startSession(
    connectionId: string,
  ): AsyncGenerator<WhatsAppSessionEvent> {
    // Load connection
    const connection = await this.connectionService.get(this.paths, connectionId);
    if (!connection) {
      yield { type: "status", status: "error", message: "Connection not found." };
      return;
    }

    // Parse or generate auth dir
    const config = this.parseConfig(connection.configRef);
    const authDir =
      config?.authDir ??
      `${this.paths.homeDir}/whatsapp-sessions/${connectionId}`;

    // Update configRef with authDir if not set
    if (!config?.authDir) {
      await this.connectionService.updateStatus(
        this.paths,
        connectionId,
        connection.status,
        JSON.stringify({ authDir }),
      );
    }

    yield { type: "status", status: "connecting" };

    // Initialize auth state
    const { state, saveCreds } = await this.initAuthStateFn(authDir);

    // Create Baileys socket
    const socket = this.makeSocketFn({
      auth: state,
      browser: ["OpenGoat", "Desktop", "1.0"],
      markOnlineOnConnect: false,
    });

    // Store active session
    this.activeSessions.set(connectionId, { socket, connectionId });

    // Create a promise-based event queue for the generator
    const eventQueue: WhatsAppSessionEvent[] = [];
    let resolveWait: (() => void) | undefined;
    let done = false;

    const pushEvent = (event: WhatsAppSessionEvent) => {
      eventQueue.push(event);
      if (resolveWait) {
        resolveWait();
        resolveWait = undefined;
      }
    };

    // Register event handlers via ev.process for batch processing
    socket.ev.process(async (events) => {
      // Handle creds update
      if (events["creds.update"]) {
        await saveCreds();
      }

      // Handle connection updates (QR codes, connection state)
      if (events["connection.update"]) {
        const update = events["connection.update"] as Record<string, unknown>;

        if (update.qr) {
          // Convert QR string to base64 data URL
          const dataUrl = await this.qrToDataUrlFn(update.qr as string);
          pushEvent({ type: "qr", data: dataUrl });
        }

        if (update.connection === "open") {
          // Successfully connected
          await this.connectionService.updateStatus(
            this.paths,
            connectionId,
            "connected",
            JSON.stringify({ authDir }),
          );
          pushEvent({ type: "status", status: "connected" });
          done = true;
          if (resolveWait) {
            resolveWait();
            resolveWait = undefined;
          }
        }

        if (update.connection === "close") {
          const lastDisconnect = update.lastDisconnect as
            | { error?: { output?: { statusCode?: number } } }
            | undefined;
          const statusCode = lastDisconnect?.error?.output?.statusCode ?? 500;

          if (FATAL_DISCONNECT_CODES.has(statusCode)) {
            const reason =
              WHATSAPP_DISCONNECT_REASONS[statusCode] ?? "Session ended.";
            await this.connectionService.updateStatus(
              this.paths,
              connectionId,
              "error",
              JSON.stringify({ authDir }),
            );
            this.activeSessions.delete(connectionId);
            pushEvent({ type: "status", status: "error", message: reason });
            done = true;
            if (resolveWait) {
              resolveWait();
              resolveWait = undefined;
            }
          } else {
            // Transient failure — for the SSE session, report error and close
            const reason =
              WHATSAPP_DISCONNECT_REASONS[statusCode] ??
              `Disconnected (code ${statusCode}).`;
            await this.connectionService.updateStatus(
              this.paths,
              connectionId,
              "disconnected",
              JSON.stringify({ authDir }),
            );
            this.activeSessions.delete(connectionId);
            pushEvent({
              type: "status",
              status: "disconnected",
              message: reason,
            });
            done = true;
            if (resolveWait) {
              resolveWait();
              resolveWait = undefined;
            }
          }
        }
      }

      // Handle inbound messages
      if (events["messages.upsert"]) {
        const upsert = events["messages.upsert"] as {
          messages: WAMessage[];
          type: string;
        };
        // Don't await — handle asynchronously to not block the event loop
        void this.handleInboundMessage(
          connectionId,
          upsert.messages,
          upsert.type,
        );
      }
    });

    // Yield events as they arrive
    while (!done || eventQueue.length > 0) {
      if (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      } else if (!done) {
        await new Promise<void>((resolve) => {
          resolveWait = resolve;
        });
      }
    }
  }

  /**
   * Handle inbound WhatsApp messages.
   * Filters to real-time text messages, routes through bridge, and sends chunked responses.
   */
  public async handleInboundMessage(
    connectionId: string,
    messages: WAMessage[],
    type: string,
  ): Promise<void> {
    // Only process real-time messages, not history sync
    if (type !== "notify") {
      return;
    }

    const session = this.activeSessions.get(connectionId);
    if (!session) {
      return;
    }

    for (const msg of messages) {
      // Skip own messages
      if (msg.key.fromMe) {
        continue;
      }

      // Extract text content
      const text = this.extractText(msg);
      if (!text) {
        continue;
      }

      const remoteJid = msg.key.remoteJid;
      if (!remoteJid) {
        continue;
      }

      const externalThreadId = `wa:${remoteJid}`;

      // Check if new thread for intro message
      const threadResult = await this.routerService.resolveThread(
        this.paths,
        connectionId,
        externalThreadId,
      );

      if (threadResult.isNew) {
        const introText = WHATSAPP_INTRODUCTION_MESSAGE.replace(
          "{projectName}",
          "your project",
        );
        await session.socket.sendMessage(remoteJid, { text: introText });
      }

      // Route through bridge
      const result = await this.bridgeService.handleInboundMessage(this.paths, {
        connectionId,
        externalThreadId,
        senderName: undefined, // WhatsApp doesn't easily provide sender name from message
        text,
        timestamp: new Date(
          (msg.messageTimestamp ?? Date.now() / 1000) * 1000,
        ).toISOString(),
        channelType: "whatsapp",
      });

      // Format and chunk response
      const formatted = formatForWhatsApp(result.text);
      const chunks = chunkMessage(formatted);

      // Send each chunk
      for (const chunk of chunks) {
        await session.socket.sendMessage(remoteJid, { text: chunk });
      }
    }
  }

  /**
   * Stop a WhatsApp session.
   */
  public async stopSession(connectionId: string): Promise<void> {
    const session = this.activeSessions.get(connectionId);
    if (session) {
      session.socket.end();
      this.activeSessions.delete(connectionId);
    }
    await this.connectionService.updateStatus(
      this.paths,
      connectionId,
      "disconnected",
      undefined,
    );
  }

  /**
   * Get the active socket for a connection (used by sidecar routes for status checks).
   */
  public getActiveSocket(connectionId: string): BaileysSocket | undefined {
    return this.activeSessions.get(connectionId)?.socket;
  }

  /**
   * Check if a session is active for the given connection.
   */
  public hasActiveSession(connectionId: string): boolean {
    return this.activeSessions.has(connectionId);
  }

  private extractText(msg: WAMessage): string | undefined {
    if (!msg.message) return undefined;
    // Standard text message
    if (typeof msg.message.conversation === "string") {
      return msg.message.conversation;
    }
    // Extended text message (e.g., quoted reply)
    const extended = msg.message.extendedTextMessage as
      | { text?: string }
      | undefined;
    if (extended?.text) {
      return extended.text;
    }
    return undefined;
  }

  private parseConfig(
    configRef: string | null,
  ): WhatsAppConnectionConfig | undefined {
    if (!configRef) return undefined;
    try {
      return JSON.parse(configRef) as WhatsAppConnectionConfig;
    } catch {
      return undefined;
    }
  }
}
