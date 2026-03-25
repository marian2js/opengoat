import type { OpenGoatPaths } from "../../domain/opengoat-paths.js";
import type { MessagingConnectionService } from "../../messaging-connections/application/messaging-connection.service.js";
import type { MessagingRouterService } from "../../messaging-router/application/messaging-router.service.js";
import type {
  GatewayPort,
  InboundMessageEvent,
  OutboundMessageResult,
} from "../domain/messaging-bridge.js";

interface ChatSdkBridgeServiceDeps {
  connectionService: MessagingConnectionService;
  routerService: MessagingRouterService;
  gateway: GatewayPort;
}

export class ChatSdkBridgeService {
  private readonly connectionService: MessagingConnectionService;
  private readonly routerService: MessagingRouterService;
  private readonly gateway: GatewayPort;

  public constructor(deps: ChatSdkBridgeServiceDeps) {
    this.connectionService = deps.connectionService;
    this.routerService = deps.routerService;
    this.gateway = deps.gateway;
  }

  public async handleInboundMessage(
    paths: OpenGoatPaths,
    event: InboundMessageEvent,
  ): Promise<OutboundMessageResult> {
    const connection = await this.connectionService.get(
      paths,
      event.connectionId,
    );
    if (!connection) {
      throw new Error(`Connection "${event.connectionId}" not found.`);
    }

    if (connection.status !== "connected") {
      throw new Error(
        `Connection "${event.connectionId}" is not connected (status: ${connection.status}).`,
      );
    }

    const threadResult = await this.routerService.resolveThread(
      paths,
      event.connectionId,
      event.externalThreadId,
    );

    const responseText = await this.gateway.sendMessage(
      threadResult.projectId,
      threadResult.chatThreadId,
      event.text,
      event.channelType,
    );

    await this.routerService.updateLastSeen(paths, threadResult.chatThreadId);

    return {
      externalThreadId: event.externalThreadId,
      text: responseText,
    };
  }
}
