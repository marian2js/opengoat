export {
  OPENGOAT_GATEWAY_PROTOCOL_VERSION,
  OPENGOAT_GATEWAY_DEFAULTS,
  OPENGOAT_GATEWAY_SCOPES,
  OPENGOAT_GATEWAY_METHODS,
  OPENGOAT_GATEWAY_EVENTS,
  OPENGOAT_GATEWAY_ERROR_CODES,
  isOpenGoatGatewayMethod,
  isReadMethod,
  parseGatewayRequestFrame,
  parseConnectParams,
  parseAgentRunParams,
  parseSessionListParams,
  parseSessionHistoryParams
} from "./domain/protocol.js";

export type {
  OpenGoatGatewayScope,
  OpenGoatGatewayMethod,
  OpenGoatGatewayEvent,
  OpenGoatGatewayErrorShape,
  OpenGoatGatewayRequestFrame,
  OpenGoatGatewayResponseFrame,
  OpenGoatGatewayEventFrame,
  OpenGoatGatewayClientInfo,
  OpenGoatGatewayConnectParams,
  OpenGoatGatewayAgentRunParams,
  OpenGoatGatewaySessionListParams,
  OpenGoatGatewaySessionHistoryParams,
  ParseResult
} from "./domain/protocol.js";
