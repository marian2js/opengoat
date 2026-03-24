import { describe, expect, it, vi, beforeEach } from "vitest";
import { TelegramChannelService } from "../packages/core/src/core/telegram-channel/application/telegram-channel.service.js";
import type { ChatSdkBridgeService } from "../packages/core/src/core/messaging-bridge/application/messaging-bridge.service.js";
import type { MessagingConnectionService } from "../packages/core/src/core/messaging-connections/application/messaging-connection.service.js";
import type { MessagingRouterService } from "../packages/core/src/core/messaging-router/application/messaging-router.service.js";
import type { OpenGoatPaths } from "../packages/core/src/core/domain/opengoat-paths.js";
import type { TelegramUpdate } from "../packages/core/src/core/telegram-channel/domain/telegram-channel.js";

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
    connectionId: "conn-tg-1",
    workspaceId: "ws-1",
    type: "telegram" as const,
    status: "connected" as const,
    displayName: "My Telegram Bot",
    defaultProjectId: "proj-1",
    configRef: JSON.stringify({
      botToken: "123456:ABC-DEF",
      secretToken: "secret-abc",
    }),
    createdAt: "2026-03-24T12:00:00.000Z",
    updatedAt: "2026-03-24T12:00:00.000Z",
    ...overrides,
  };
}

describe("TelegramChannelService", () => {
  let service: TelegramChannelService;
  let mockConnectionService: MessagingConnectionService;
  let mockRouterService: MessagingRouterService;
  let mockBridgeService: ChatSdkBridgeService;
  let mockFetch: ReturnType<typeof vi.fn>;
  const paths = createTestPaths();

  beforeEach(() => {
    mockConnectionService = {
      get: vi.fn().mockResolvedValue(makeConnection()),
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
        externalThreadId: "tg:12345",
        text: "Here are your homepage rewrites!",
      }),
    } as unknown as ChatSdkBridgeService;

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
    });

    service = new TelegramChannelService({
      connectionService: mockConnectionService,
      routerService: mockRouterService,
      bridgeService: mockBridgeService,
      paths,
      fetchFn: mockFetch,
    });
  });

  it("handles a text message update by routing through bridge and replying", async () => {
    const update: TelegramUpdate = {
      update_id: 1,
      message: {
        message_id: 100,
        from: { id: 42, is_bot: false, first_name: "John" },
        chat: { id: 12345, type: "private" },
        date: 1711234567,
        text: "Help me with my homepage",
      },
    };

    const result = await service.handleWebhook("conn-tg-1", "secret-abc", update);

    expect(result.ok).toBe(true);
    expect(mockBridgeService.handleInboundMessage).toHaveBeenCalledWith(
      paths,
      expect.objectContaining({
        connectionId: "conn-tg-1",
        externalThreadId: "tg:12345",
        senderName: "John",
        text: "Help me with my homepage",
      }),
    );
    // Should send response back to Telegram
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/sendMessage"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("12345"),
      }),
    );
  });

  it("sends introduction message when thread is new", async () => {
    (mockRouterService.resolveThread as ReturnType<typeof vi.fn>).mockResolvedValue({
      projectId: "proj-1",
      chatThreadId: "thread-new",
      isNew: true,
    });

    const update: TelegramUpdate = {
      update_id: 2,
      message: {
        message_id: 101,
        from: { id: 42, is_bot: false, first_name: "Jane" },
        chat: { id: 67890, type: "private" },
        date: 1711234568,
        text: "Hello",
      },
    };

    await service.handleWebhook("conn-tg-1", "secret-abc", update);

    // Should have sent 2 messages: intro + agent response
    const sendCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/sendMessage"),
    );
    expect(sendCalls.length).toBe(2);
    // First call should be the introduction
    const introBody = JSON.parse(sendCalls[0][1].body);
    expect(introBody.text).toContain("CMO assistant");
  });

  it("rejects webhook when secret token does not match", async () => {
    const update: TelegramUpdate = {
      update_id: 3,
      message: {
        message_id: 102,
        chat: { id: 12345, type: "private" },
        date: 1711234569,
        text: "test",
      },
    };

    const result = await service.handleWebhook("conn-tg-1", "wrong-secret", update);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("secret token");
    expect(mockBridgeService.handleInboundMessage).not.toHaveBeenCalled();
  });

  it("rejects webhook for non-existent connection", async () => {
    (mockConnectionService.get as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const update: TelegramUpdate = {
      update_id: 4,
      message: {
        message_id: 103,
        chat: { id: 12345, type: "private" },
        date: 1711234570,
        text: "test",
      },
    };

    const result = await service.handleWebhook("non-existent", "secret-abc", update);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("rejects webhook for disconnected connection", async () => {
    (mockConnectionService.get as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeConnection({ status: "disconnected" }),
    );

    const update: TelegramUpdate = {
      update_id: 5,
      message: {
        message_id: 104,
        chat: { id: 12345, type: "private" },
        date: 1711234571,
        text: "test",
      },
    };

    const result = await service.handleWebhook("conn-tg-1", "secret-abc", update);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not connected");
  });

  it("handles callback query by routing predefined response through bridge", async () => {
    const update: TelegramUpdate = {
      update_id: 6,
      callback_query: {
        id: "cb-1",
        from: { id: 42, is_bot: false, first_name: "John" },
        message: {
          message_id: 100,
          chat: { id: 12345, type: "private" },
          date: 1711234572,
        },
        data: "continue",
      },
    };

    const result = await service.handleWebhook("conn-tg-1", "secret-abc", update);

    expect(result.ok).toBe(true);
    // Should have answered the callback query
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/answerCallbackQuery"),
      expect.any(Object),
    );
    // Should have sent the follow-up message through bridge
    expect(mockBridgeService.handleInboundMessage).toHaveBeenCalledWith(
      paths,
      expect.objectContaining({
        text: "What would you like to do next?",
      }),
    );
  });

  it("ignores updates without message or callback_query", async () => {
    const update: TelegramUpdate = {
      update_id: 7,
    };

    const result = await service.handleWebhook("conn-tg-1", "secret-abc", update);

    expect(result.ok).toBe(true);
    expect(mockBridgeService.handleInboundMessage).not.toHaveBeenCalled();
  });

  it("includes follow-up inline keyboard buttons in agent responses", async () => {
    const update: TelegramUpdate = {
      update_id: 8,
      message: {
        message_id: 105,
        from: { id: 42, is_bot: false, first_name: "John" },
        chat: { id: 12345, type: "private" },
        date: 1711234573,
        text: "Write me homepage copy",
      },
    };

    await service.handleWebhook("conn-tg-1", "secret-abc", update);

    // The agent response message should include inline keyboard
    const sendCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("/sendMessage"),
    );
    const lastSendBody = JSON.parse(sendCalls[sendCalls.length - 1][1].body);
    expect(lastSendBody.reply_markup).toBeDefined();
    expect(lastSendBody.reply_markup.inline_keyboard).toBeDefined();
  });
});
