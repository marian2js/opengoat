import { describe, expect, it, vi, beforeEach } from "vitest";
import { WhatsAppChannelService } from "../packages/core/src/core/whatsapp-channel/application/whatsapp-channel.service.js";
import type { ChatSdkBridgeService } from "../packages/core/src/core/messaging-bridge/application/messaging-bridge.service.js";
import type { MessagingConnectionService } from "../packages/core/src/core/messaging-connections/application/messaging-connection.service.js";
import type { MessagingRouterService } from "../packages/core/src/core/messaging-router/application/messaging-router.service.js";
import type { OpenGoatPaths } from "../packages/core/src/core/domain/opengoat-paths.js";
import type {
  BaileysSocket,
  MakeSocketFn,
  InitAuthStateFn,
  WhatsAppSessionEvent,
} from "../packages/core/src/core/whatsapp-channel/domain/whatsapp-channel.js";

function createTestPaths(): OpenGoatPaths {
  return {
    homeDir: "/tmp/test",
    workspacesDir: "/tmp/test/workspaces",
    projectsDir: "/tmp/test/projects",
    organizationDir: "/tmp/test/organization",
    agentsDir: "/tmp/test/agents",
    skillsDir: "/tmp/test/skills",
    providersDir: "/tmp/test/providers",
    sessionsDir: "/tmp/test/sessions",
    runsDir: "/tmp/test/runs",
    globalConfigJsonPath: "/tmp/test/config.json",
    globalConfigMarkdownPath: "/tmp/test/CONFIG.md",
    agentsIndexJsonPath: "/tmp/test/agents.json",
  };
}

function makeConnection(overrides: Record<string, unknown> = {}) {
  return {
    connectionId: "conn-wa-1",
    workspaceId: "ws-1",
    type: "whatsapp" as const,
    status: "connected" as const,
    displayName: "My WhatsApp",
    defaultProjectId: "proj-1",
    configRef: JSON.stringify({ authDir: "/tmp/test/whatsapp-sessions/conn-wa-1" }),
    createdAt: "2026-03-24T12:00:00.000Z",
    updatedAt: "2026-03-24T12:00:00.000Z",
    ...overrides,
  };
}

type EventProcessHandler = (events: Record<string, unknown>) => Promise<void>;

function createMockSocket(): {
  socket: BaileysSocket;
  triggerEvent: (events: Record<string, unknown>) => Promise<void>;
} {
  let processHandler: EventProcessHandler | undefined;
  const socket: BaileysSocket = {
    ev: {
      process: (handler: EventProcessHandler) => {
        processHandler = handler;
      },
      on: vi.fn(),
    },
    sendMessage: vi.fn().mockResolvedValue({}),
    end: vi.fn(),
  };
  return {
    socket,
    triggerEvent: async (events: Record<string, unknown>) => {
      if (processHandler) {
        await processHandler(events);
      }
    },
  };
}

describe("WhatsAppChannelService", () => {
  let service: WhatsAppChannelService;
  let mockConnectionService: MessagingConnectionService;
  let mockRouterService: MessagingRouterService;
  let mockBridgeService: ChatSdkBridgeService;
  let mockMakeSocket: MakeSocketFn;
  let mockInitAuthState: InitAuthStateFn;
  let mockQrToDataUrl: (text: string) => Promise<string>;
  let mockSocketInstance: BaileysSocket;
  let triggerSocketEvent: (events: Record<string, unknown>) => Promise<void>;
  const paths = createTestPaths();

  beforeEach(() => {
    const { socket, triggerEvent } = createMockSocket();
    mockSocketInstance = socket;
    triggerSocketEvent = triggerEvent;

    mockConnectionService = {
      get: vi.fn().mockResolvedValue(makeConnection({ status: "pending" })),
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
    } as unknown as MessagingConnectionService;

    mockRouterService = {
      resolveThread: vi.fn().mockResolvedValue({
        projectId: "proj-1",
        chatThreadId: "thread-abc",
        isNew: false,
      }),
      updateLastSeen: vi.fn().mockResolvedValue(undefined),
      listThreadLinks: vi.fn().mockResolvedValue([]),
    } as unknown as MessagingRouterService;

    mockBridgeService = {
      handleInboundMessage: vi.fn().mockResolvedValue({
        externalThreadId: "wa:12345@s.whatsapp.net",
        text: "Here are your homepage rewrites!",
      }),
    } as unknown as ChatSdkBridgeService;

    mockMakeSocket = vi.fn().mockReturnValue(mockSocketInstance);

    mockInitAuthState = vi.fn().mockResolvedValue({
      state: { creds: {}, keys: {} },
      saveCreds: vi.fn(),
    });

    mockQrToDataUrl = vi.fn().mockResolvedValue("data:image/png;base64,MOCK_QR");

    service = new WhatsAppChannelService({
      connectionService: mockConnectionService,
      routerService: mockRouterService,
      bridgeService: mockBridgeService,
      paths,
      qrToDataUrlFn: mockQrToDataUrl,
      makeSocketFn: mockMakeSocket,
      initAuthStateFn: mockInitAuthState,
    });
  });

  it("startSession initializes auth state and creates socket", async () => {
    const generator = service.startSession("conn-wa-1");

    // Trigger a QR event from the socket so the generator yields something
    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": { qr: "qr-string-data" },
      });
      // Then close with connected
      await triggerSocketEvent({
        "connection.update": { connection: "open" },
      });
    }, 10);

    const events: WhatsAppSessionEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    expect(mockInitAuthState).toHaveBeenCalled();
    expect(mockMakeSocket).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.anything(),
        markOnlineOnConnect: false,
      }),
    );
  });

  it("startSession yields QR events from connection.update", async () => {
    const generator = service.startSession("conn-wa-1");

    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": { qr: "first-qr" },
      });
      await triggerSocketEvent({
        "connection.update": { qr: "second-qr" },
      });
      await triggerSocketEvent({
        "connection.update": { connection: "open" },
      });
    }, 10);

    const events: WhatsAppSessionEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    const qrEvents = events.filter((e) => e.type === "qr");
    expect(qrEvents.length).toBe(2);
    expect(mockQrToDataUrl).toHaveBeenCalledWith("first-qr");
    expect(mockQrToDataUrl).toHaveBeenCalledWith("second-qr");
  });

  it("startSession yields connected status on successful auth", async () => {
    const generator = service.startSession("conn-wa-1");

    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": { connection: "open" },
      });
    }, 10);

    const events: WhatsAppSessionEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    const statusEvents = events.filter(
      (e) => e.type === "status" && e.status === "connected",
    );
    expect(statusEvents.length).toBe(1);
    expect(mockConnectionService.updateStatus).toHaveBeenCalledWith(
      paths,
      "conn-wa-1",
      "connected",
      expect.any(String),
    );
  });

  it("handleInboundMessage routes text through bridge and sends chunked response", async () => {
    // First start a session so there's an active socket
    const generator = service.startSession("conn-wa-1");
    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": { connection: "open" },
      });
    }, 10);
    for await (const _event of generator) {
      // drain
    }

    // Now update the connection mock to "connected"
    (mockConnectionService.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeConnection({ status: "connected" }),
    );

    // Simulate an inbound message
    await service.handleInboundMessage("conn-wa-1", [
      {
        key: {
          remoteJid: "12345@s.whatsapp.net",
          fromMe: false,
          id: "msg-1",
        },
        message: { conversation: "Help me with my homepage" },
        messageTimestamp: 1711234567,
      },
    ], "notify");

    expect(mockBridgeService.handleInboundMessage).toHaveBeenCalledWith(
      paths,
      expect.objectContaining({
        connectionId: "conn-wa-1",
        externalThreadId: "wa:12345@s.whatsapp.net",
        text: "Help me with my homepage",
      }),
    );
    expect(mockSocketInstance.sendMessage).toHaveBeenCalledWith(
      "12345@s.whatsapp.net",
      expect.objectContaining({ text: expect.any(String) }),
    );
  });

  it("handleInboundMessage sends intro message on new thread", async () => {
    const generator = service.startSession("conn-wa-1");
    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": { connection: "open" },
      });
    }, 10);
    for await (const _event of generator) {
      // drain
    }

    (mockConnectionService.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeConnection({ status: "connected" }),
    );
    (mockRouterService.resolveThread as ReturnType<typeof vi.fn>).mockResolvedValue({
      projectId: "proj-1",
      chatThreadId: "thread-new",
      isNew: true,
    });

    await service.handleInboundMessage("conn-wa-1", [
      {
        key: {
          remoteJid: "67890@s.whatsapp.net",
          fromMe: false,
          id: "msg-2",
        },
        message: { conversation: "Hello" },
        messageTimestamp: 1711234568,
      },
    ], "notify");

    // Should send intro + agent response = at least 2 calls
    const sendCalls = (mockSocketInstance.sendMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(sendCalls.length).toBeGreaterThanOrEqual(2);
    const introCall = sendCalls[0];
    expect(introCall[1].text).toContain("CMO assistant");
  });

  it("handleInboundMessage skips fromMe messages", async () => {
    const generator = service.startSession("conn-wa-1");
    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": { connection: "open" },
      });
    }, 10);
    for await (const _event of generator) {
      // drain
    }

    await service.handleInboundMessage("conn-wa-1", [
      {
        key: {
          remoteJid: "12345@s.whatsapp.net",
          fromMe: true,
          id: "msg-3",
        },
        message: { conversation: "My own message" },
        messageTimestamp: 1711234569,
      },
    ], "notify");

    expect(mockBridgeService.handleInboundMessage).not.toHaveBeenCalled();
  });

  it("handleInboundMessage skips non-text messages", async () => {
    const generator = service.startSession("conn-wa-1");
    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": { connection: "open" },
      });
    }, 10);
    for await (const _event of generator) {
      // drain
    }

    await service.handleInboundMessage("conn-wa-1", [
      {
        key: {
          remoteJid: "12345@s.whatsapp.net",
          fromMe: false,
          id: "msg-4",
        },
        message: { imageMessage: { mimetype: "image/jpeg" } },
        messageTimestamp: 1711234570,
      },
    ], "notify");

    expect(mockBridgeService.handleInboundMessage).not.toHaveBeenCalled();
  });

  it("handleInboundMessage skips append-type messages (history sync)", async () => {
    const generator = service.startSession("conn-wa-1");
    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": { connection: "open" },
      });
    }, 10);
    for await (const _event of generator) {
      // drain
    }

    await service.handleInboundMessage("conn-wa-1", [
      {
        key: {
          remoteJid: "12345@s.whatsapp.net",
          fromMe: false,
          id: "msg-5",
        },
        message: { conversation: "Old message" },
        messageTimestamp: 1711234571,
      },
    ], "append");

    expect(mockBridgeService.handleInboundMessage).not.toHaveBeenCalled();
  });

  it("stopSession disconnects socket and updates status", async () => {
    const generator = service.startSession("conn-wa-1");
    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": { connection: "open" },
      });
    }, 10);
    for await (const _event of generator) {
      // drain
    }

    await service.stopSession("conn-wa-1");

    expect(mockSocketInstance.end).toHaveBeenCalled();
    expect(mockConnectionService.updateStatus).toHaveBeenLastCalledWith(
      paths,
      "conn-wa-1",
      "disconnected",
      undefined,
    );
  });

  it("yields error event on fatal disconnect (loggedOut 401)", async () => {
    const generator = service.startSession("conn-wa-1");

    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": {
          connection: "close",
          lastDisconnect: {
            error: { output: { statusCode: 401 } },
          },
        },
      });
    }, 10);

    const events: WhatsAppSessionEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    const errorEvents = events.filter(
      (e) => e.type === "status" && e.status === "error",
    );
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].message).toContain("Logged out");
  });

  it("yields error event on fatal disconnect (forbidden 403)", async () => {
    const generator = service.startSession("conn-wa-1");

    setTimeout(async () => {
      await triggerSocketEvent({
        "connection.update": {
          connection: "close",
          lastDisconnect: {
            error: { output: { statusCode: 403 } },
          },
        },
      });
    }, 10);

    const events: WhatsAppSessionEvent[] = [];
    for await (const event of generator) {
      events.push(event);
    }

    const errorEvents = events.filter(
      (e) => e.type === "status" && e.status === "error",
    );
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].message).toContain("Forbidden");
  });
});
