import { describe, expect, it, vi } from "vitest";
import { ChatSdkBridgeService } from "../packages/core/src/core/messaging-bridge/application/messaging-bridge.service.js";
import type { GatewayPort } from "../packages/core/src/core/messaging-bridge/domain/messaging-bridge.js";
import type { MessagingConnectionService } from "../packages/core/src/core/messaging-connections/application/messaging-connection.service.js";
import type { MessagingRouterService } from "../packages/core/src/core/messaging-router/application/messaging-router.service.js";
import type { InboundMessageEvent, OutboundMessageResult } from "../packages/core/src/core/messaging-bridge/domain/messaging-bridge.js";
import type { OpenGoatPaths } from "../packages/core/src/core/domain/opengoat-paths.js";

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

describe("ChatSdkBridgeService", () => {
  it("handles an inbound message by resolving thread and calling gateway", async () => {
    const mockGateway: GatewayPort = {
      sendMessage: vi.fn().mockResolvedValue("Hello from OpenGoat CMO!"),
    };

    const mockConnectionService = {
      get: vi.fn().mockResolvedValue({
        connectionId: "conn-1",
        workspaceId: "ws-1",
        type: "telegram",
        status: "connected",
        displayName: "TG Bot",
        defaultProjectId: "proj-1",
        configRef: null,
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
      }),
    } as unknown as MessagingConnectionService;

    const mockRouterService = {
      resolveThread: vi.fn().mockResolvedValue({
        projectId: "proj-1",
        chatThreadId: "thread-abc",
        isNew: true,
      }),
      updateLastSeen: vi.fn().mockResolvedValue(undefined),
    } as unknown as MessagingRouterService;

    const bridge = new ChatSdkBridgeService({
      connectionService: mockConnectionService,
      routerService: mockRouterService,
      gateway: mockGateway,
    });

    const event: InboundMessageEvent = {
      connectionId: "conn-1",
      externalThreadId: "tg:chat:12345",
      senderName: "John",
      text: "Help me with my homepage",
      timestamp: "2026-03-24T12:00:00.000Z",
    };

    const paths = createTestPaths();
    const result: OutboundMessageResult = await bridge.handleInboundMessage(paths, event);

    expect(result.externalThreadId).toBe("tg:chat:12345");
    expect(result.text).toBe("Hello from OpenGoat CMO!");
    expect(mockRouterService.resolveThread).toHaveBeenCalledWith(
      paths,
      "conn-1",
      "tg:chat:12345",
    );
    expect(mockGateway.sendMessage).toHaveBeenCalled();
    expect(mockRouterService.updateLastSeen).toHaveBeenCalledWith(
      paths,
      "thread-abc",
    );
  });

  it("throws if connection not found", async () => {
    const mockGateway: GatewayPort = {
      sendMessage: vi.fn(),
    };

    const mockConnectionService = {
      get: vi.fn().mockResolvedValue(undefined),
    } as unknown as MessagingConnectionService;

    const mockRouterService = {
      resolveThread: vi.fn(),
      updateLastSeen: vi.fn(),
    } as unknown as MessagingRouterService;

    const bridge = new ChatSdkBridgeService({
      connectionService: mockConnectionService,
      routerService: mockRouterService,
      gateway: mockGateway,
    });

    const event: InboundMessageEvent = {
      connectionId: "non-existent",
      externalThreadId: "tg:chat:999",
      text: "Hello",
      timestamp: "2026-03-24T12:00:00.000Z",
    };

    await expect(
      bridge.handleInboundMessage(createTestPaths(), event),
    ).rejects.toThrow('Connection "non-existent" not found');
  });

  it("throws if connection is not in connected status", async () => {
    const mockGateway: GatewayPort = {
      sendMessage: vi.fn(),
    };

    const mockConnectionService = {
      get: vi.fn().mockResolvedValue({
        connectionId: "conn-1",
        workspaceId: "ws-1",
        type: "telegram",
        status: "disconnected",
        displayName: "TG Bot",
        defaultProjectId: "proj-1",
        configRef: null,
        createdAt: "2026-03-24T12:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
      }),
    } as unknown as MessagingConnectionService;

    const mockRouterService = {
      resolveThread: vi.fn(),
      updateLastSeen: vi.fn(),
    } as unknown as MessagingRouterService;

    const bridge = new ChatSdkBridgeService({
      connectionService: mockConnectionService,
      routerService: mockRouterService,
      gateway: mockGateway,
    });

    const event: InboundMessageEvent = {
      connectionId: "conn-1",
      externalThreadId: "tg:chat:123",
      text: "Hello",
      timestamp: "2026-03-24T12:00:00.000Z",
    };

    await expect(
      bridge.handleInboundMessage(createTestPaths(), event),
    ).rejects.toThrow("not connected");
  });
});
