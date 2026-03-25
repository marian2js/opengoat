import { describe, expect, it, vi } from "vitest";
import { ChatSdkBridgeService } from "../../../packages/core/src/core/messaging-bridge/application/messaging-bridge.service.js";
import type { GatewayPort } from "../../../packages/core/src/core/messaging-bridge/domain/messaging-bridge.js";
import type { MessagingConnectionService } from "../../../packages/core/src/core/messaging-connections/application/messaging-connection.service.js";
import type { MessagingRouterService } from "../../../packages/core/src/core/messaging-router/application/messaging-router.service.js";
import type { OpenGoatPaths } from "../../../packages/core/src/core/domain/opengoat-paths.js";

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

describe("ChatSdkBridgeService – channelType threading", () => {
  it("passes channelType from InboundMessageEvent to gateway.sendMessage", async () => {
    const paths = createTestPaths();

    const mockConnectionService = {
      get: vi.fn().mockResolvedValue({
        connectionId: "conn-1",
        status: "connected",
        defaultProjectId: "proj-1",
      }),
    } as unknown as MessagingConnectionService;

    const mockRouterService = {
      resolveThread: vi.fn().mockResolvedValue({
        projectId: "proj-1",
        chatThreadId: "thread-abc",
        isNew: false,
      }),
      updateLastSeen: vi.fn().mockResolvedValue(undefined),
    } as unknown as MessagingRouterService;

    const mockGateway: GatewayPort = {
      sendMessage: vi.fn().mockResolvedValue("response text"),
    };

    const service = new ChatSdkBridgeService({
      connectionService: mockConnectionService,
      routerService: mockRouterService,
      gateway: mockGateway,
    });

    await service.handleInboundMessage(paths, {
      connectionId: "conn-1",
      externalThreadId: "tg:12345",
      text: "Help me",
      timestamp: new Date().toISOString(),
      channelType: "telegram",
    });

    expect(mockGateway.sendMessage).toHaveBeenCalledWith(
      "proj-1",
      "thread-abc",
      "Help me",
      "telegram",
    );
  });

  it("passes undefined channelType when not specified", async () => {
    const paths = createTestPaths();

    const mockConnectionService = {
      get: vi.fn().mockResolvedValue({
        connectionId: "conn-1",
        status: "connected",
        defaultProjectId: "proj-1",
      }),
    } as unknown as MessagingConnectionService;

    const mockRouterService = {
      resolveThread: vi.fn().mockResolvedValue({
        projectId: "proj-1",
        chatThreadId: "thread-abc",
        isNew: false,
      }),
      updateLastSeen: vi.fn().mockResolvedValue(undefined),
    } as unknown as MessagingRouterService;

    const mockGateway: GatewayPort = {
      sendMessage: vi.fn().mockResolvedValue("response text"),
    };

    const service = new ChatSdkBridgeService({
      connectionService: mockConnectionService,
      routerService: mockRouterService,
      gateway: mockGateway,
    });

    await service.handleInboundMessage(paths, {
      connectionId: "conn-1",
      externalThreadId: "tg:12345",
      text: "Hello",
      timestamp: new Date().toISOString(),
    });

    expect(mockGateway.sendMessage).toHaveBeenCalledWith(
      "proj-1",
      "thread-abc",
      "Hello",
      undefined,
    );
  });
});
