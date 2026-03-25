import { Hono } from "hono";
import { stream } from "hono/streaming";
import type { SidecarRuntime } from "../context.ts";

/**
 * WhatsApp session management routes (require basic auth).
 * Mounted at /messaging/whatsapp
 */
export function createWhatsAppSessionRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.post("/start-session/:connectionId", async (context) => {
    const connectionId = context.req.param("connectionId");

    // Start the session in the background (the QR SSE endpoint will consume events)
    // Just trigger the session — the actual event stream is consumed via the SSE endpoint
    void runtime.whatsappChannelService.startSession(connectionId);

    return context.json({
      ok: true,
      message: "Session started. Subscribe to QR events via SSE.",
    });
  });

  app.post("/stop-session/:connectionId", async (context) => {
    const connectionId = context.req.param("connectionId");
    await runtime.whatsappChannelService.stopSession(connectionId);
    return context.json({ ok: true });
  });

  return app;
}

/**
 * WhatsApp QR code SSE route (NO basic auth — scoped to connectionId).
 * Mounted at /messaging/whatsapp/qr BEFORE auth middleware.
 */
export function createWhatsAppQrRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.get("/qr/:connectionId", (context) => {
    const connectionId = context.req.param("connectionId");

    context.header("Content-Type", "text/event-stream");
    context.header("Cache-Control", "no-cache");
    context.header("Connection", "keep-alive");

    return stream(context, async (s) => {
      const generator = runtime.whatsappChannelService.startSession(connectionId);

      for await (const event of generator) {
        await s.write(`data: ${JSON.stringify(event)}\n\n`);

        // Close stream when connected or on fatal error
        if (event.type === "status" && (event.status === "connected" || event.status === "error")) {
          break;
        }
      }
    });
  });

  return app;
}
