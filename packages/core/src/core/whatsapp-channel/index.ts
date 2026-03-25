export { WhatsAppChannelService } from "./application/whatsapp-channel.service.js";
export {
  chunkMessage,
  formatForWhatsApp,
  createMediaPlaceholder,
} from "./application/whatsapp-format-converter.js";
export type {
  WhatsAppConnectionConfig,
  QrCodeEvent,
  ConnectionStatusEvent,
  WhatsAppSessionEvent,
  WhatsAppChannelDeps,
  BaileysAuthState,
  BaileysSocket,
  MakeSocketFn,
  InitAuthStateFn,
} from "./domain/whatsapp-channel.js";
export {
  WHATSAPP_ADAPTER_NAME,
  WHATSAPP_MAX_CHUNK_LENGTH,
  WHATSAPP_INTRODUCTION_MESSAGE,
  FATAL_DISCONNECT_CODES,
  MAX_RECONNECT_ATTEMPTS,
  WHATSAPP_DISCONNECT_REASONS,
} from "./domain/whatsapp-channel.js";
