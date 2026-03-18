import { createSidecarBootstrap, createSidecarHealth } from "@opengoat/core";
import type { Context } from "hono";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { SidecarRuntime } from "../context.ts";

export function createGlobalRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.get("/health", (context) => {
    return context.json(createSidecarHealth(runtime.version));
  });

  app.get("/bootstrap", (context) => {
    return context.json(createSidecarBootstrap(runtime.version));
  });

  app.get("/events", (context) => {
    prepareEventStream(context);

    return streamSSE(context, async (stream) => {
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({
          timestamp: new Date(runtime.startedAt).toISOString(),
          type: "sidecar.connected",
        }),
      });

      const heartbeat = setInterval(() => {
        void stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({
            timestamp: new Date().toISOString(),
            type: "sidecar.heartbeat",
          }),
        });
      }, 10_000);

      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat);
          resolve();
        });
      });
    });
  });

  return app;
}

function prepareEventStream(context: Context): void {
  context.header("Cache-Control", "no-cache");
  context.header("Connection", "keep-alive");
  context.header("X-Accel-Buffering", "no");
  context.header("X-Content-Type-Options", "nosniff");
}
