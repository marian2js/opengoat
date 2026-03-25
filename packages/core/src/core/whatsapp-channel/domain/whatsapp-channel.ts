import type { MessagingConnectionService } from "../../messaging-connections/application/messaging-connection.service.js";
import type { MessagingRouterService } from "../../messaging-router/application/messaging-router.service.js";
import type { ChatSdkBridgeService } from "../../messaging-bridge/application/messaging-bridge.service.js";
import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";

// ---------------------------------------------------------------------------
// Connection Config
// ---------------------------------------------------------------------------

export interface WhatsAppConnectionConfig {
  authDir: string;
}

// ---------------------------------------------------------------------------
// Session Events (delivered via SSE to the UI)
// ---------------------------------------------------------------------------

export interface QrCodeEvent {
  type: "qr";
  data: string; // base64 data URL of QR code PNG
}

export interface ConnectionStatusEvent {
  type: "status";
  status: "connecting" | "connected" | "disconnected" | "error";
  message?: string;
}

export type WhatsAppSessionEvent = QrCodeEvent | ConnectionStatusEvent;

// ---------------------------------------------------------------------------
// Service Dependencies
// ---------------------------------------------------------------------------

export interface WhatsAppChannelDeps {
  connectionService: MessagingConnectionService;
  routerService: MessagingRouterService;
  bridgeService: ChatSdkBridgeService;
  paths: OpenGoatPaths;
  /** Converts a QR code string to a base64 data URL. Injectable for testing. */
  qrToDataUrlFn?: (text: string) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Baileys abstraction — injectable socket interface for testability
// ---------------------------------------------------------------------------

export interface BaileysAuthState {
  state: unknown;
  saveCreds: () => Promise<void>;
}

export type BaileysEventHandler = (events: Record<string, unknown>) => Promise<void>;

export interface BaileysSocket {
  ev: {
    process: (handler: BaileysEventHandler) => void;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
  };
  sendMessage: (
    jid: string,
    content: { text: string; quoted?: unknown },
  ) => Promise<unknown>;
  end: (error?: Error) => void;
}

export type MakeSocketFn = (config: {
  auth: unknown;
  browser: [string, string, string];
  markOnlineOnConnect: boolean;
}) => BaileysSocket;

export type InitAuthStateFn = (
  authDir: string,
) => Promise<BaileysAuthState>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WHATSAPP_ADAPTER_NAME = "whatsapp-baileys";

export const WHATSAPP_MAX_CHUNK_LENGTH = 2000;

export const WHATSAPP_INTRODUCTION_MESSAGE =
  "Hi, I'm your OpenGoat CMO assistant for {projectName}. I can help with homepage copy, Product Hunt launches, SEO, outbound emails, content ideas, and marketing drafts. What would you like to work on?";

/** DisconnectReason codes from Baileys that mean "do not reconnect" */
export const FATAL_DISCONNECT_CODES = new Set([
  401, // loggedOut
  403, // forbidden
]);

export const MAX_RECONNECT_ATTEMPTS = 5;

export const RECONNECT_BASE_DELAY_MS = 1000;
export const RECONNECT_MAX_DELAY_MS = 30_000;

export const WHATSAPP_DISCONNECT_REASONS: Record<number, string> = {
  401: "Logged out — please re-scan the QR code to reconnect.",
  403: "Forbidden — this session is no longer valid.",
  408: "Connection timed out — reconnecting…",
  428: "Connection closed — reconnecting…",
  440: "Connection replaced by another session.",
  500: "Server error — reconnecting…",
  515: "Stream error — reconnecting…",
};
