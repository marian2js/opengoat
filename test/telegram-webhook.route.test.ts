import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createTelegramWebhookRoutes } from "../packages/sidecar/src/server/routes/telegram-webhook.js";
import type { TelegramChannelService } from "../packages/core/src/core/telegram-channel/application/telegram-channel.service.js";

function createMockRuntime(serviceOverrides: Partial<TelegramChannelService> = {}) {
  return {
    telegramChannelService: {
      handleWebhook: vi.fn().mockResolvedValue({ ok: true }),
      ...serviceOverrides,
    } as unknown as TelegramChannelService,
  };
}

describe("Telegram Webhook Routes", () => {
  it("POST to webhook endpoint delegates to telegramChannelService", async () => {
    const runtime = createMockRuntime();
    const app = new Hono();
    app.route("/messaging/telegram/webhook", createTelegramWebhookRoutes(runtime as any));

    const body = JSON.stringify({
      update_id: 1,
      message: {
        message_id: 100,
        chat: { id: 12345, type: "private" },
        date: 1711234567,
        text: "Hello",
      },
    });

    const response = await app.request(
      "/messaging/telegram/webhook/conn-tg-1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-api-secret-token": "my-secret",
        },
        body,
      },
    );

    expect(response.status).toBe(200);
    expect(runtime.telegramChannelService.handleWebhook).toHaveBeenCalledWith(
      "conn-tg-1",
      "my-secret",
      expect.objectContaining({ update_id: 1 }),
    );
  });

  it("returns 200 with error body when service returns error", async () => {
    const runtime = createMockRuntime({
      handleWebhook: vi.fn().mockResolvedValue({
        ok: false,
        error: "Connection not found",
      }),
    } as any);
    const app = new Hono();
    app.route("/messaging/telegram/webhook", createTelegramWebhookRoutes(runtime as any));

    const response = await app.request(
      "/messaging/telegram/webhook/non-existent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-api-secret-token": "secret",
        },
        body: JSON.stringify({ update_id: 2 }),
      },
    );

    // Telegram expects 200 even for errors (to prevent retries)
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(false);
  });

  it("handles missing secret token header", async () => {
    const runtime = createMockRuntime();
    const app = new Hono();
    app.route("/messaging/telegram/webhook", createTelegramWebhookRoutes(runtime as any));

    const response = await app.request(
      "/messaging/telegram/webhook/conn-tg-1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ update_id: 3 }),
      },
    );

    expect(response.status).toBe(200);
    // Should still call the service, which will validate the token
    expect(runtime.telegramChannelService.handleWebhook).toHaveBeenCalledWith(
      "conn-tg-1",
      "",
      expect.any(Object),
    );
  });

  it("does not require authorization header (bypasses basic auth)", async () => {
    const runtime = createMockRuntime();
    const app = new Hono();
    // No auth middleware on this route
    app.route("/messaging/telegram/webhook", createTelegramWebhookRoutes(runtime as any));

    const response = await app.request(
      "/messaging/telegram/webhook/conn-tg-1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-api-secret-token": "secret",
        },
        body: JSON.stringify({ update_id: 4 }),
      },
    );

    // No 401 response — webhook route has no basic auth
    expect(response.status).toBe(200);
  });
});
