import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

export function createTelegramWebhookRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.post("/:connectionId", async (context) => {
    const connectionId = context.req.param("connectionId");
    const secretToken =
      context.req.header("x-telegram-bot-api-secret-token") ?? "";
    const update = await context.req.json();

    const result = await runtime.telegramChannelService.handleWebhook(
      connectionId,
      secretToken,
      update,
    );

    // Always return 200 to Telegram to prevent webhook retries
    return context.json(result, 200);
  });

  return app;
}
