import {
  createMessagingConnectionRequestSchema,
  updateMessagingConnectionRequestSchema,
} from "@opengoat/contracts";
import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

export function createMessagingRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.get("/connections", async (context) => {
    const workspaceId = context.req.query("workspaceId") || "default";
    const connections = await runtime.messagingConnectionService.list(
      runtime.opengoatPaths,
      workspaceId,
    );
    return context.json(connections);
  });

  app.post("/connections", async (context) => {
    const body = createMessagingConnectionRequestSchema.parse(
      await context.req.json(),
    );
    const connection = await runtime.messagingConnectionService.create(
      runtime.opengoatPaths,
      {
        workspaceId: body.workspaceId,
        type: body.type,
        displayName: body.displayName,
        defaultProjectId: body.defaultProjectId,
        configRef: body.configRef,
      },
    );
    return context.json(connection, 201);
  });

  app.get("/connections/:connectionId", async (context) => {
    const connectionId = context.req.param("connectionId");
    const connection = await runtime.messagingConnectionService.get(
      runtime.opengoatPaths,
      connectionId,
    );

    if (!connection) {
      return context.json({ error: "Connection not found" }, 404);
    }

    return context.json(connection);
  });

  app.patch("/connections/:connectionId", async (context) => {
    const connectionId = context.req.param("connectionId");
    const body = updateMessagingConnectionRequestSchema.parse(
      await context.req.json(),
    );

    try {
      const connection = await runtime.messagingConnectionService.updateStatus(
        runtime.opengoatPaths,
        connectionId,
        body.status ?? "pending",
        body.configRef ?? undefined,
      );
      return context.json(connection);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("does not exist")
      ) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.delete("/connections/:connectionId", async (context) => {
    const connectionId = context.req.param("connectionId");
    await runtime.messagingConnectionService.delete(
      runtime.opengoatPaths,
      connectionId,
    );
    return context.json({ deleted: true });
  });

  app.get("/connections/:connectionId/threads", async (context) => {
    const connectionId = context.req.param("connectionId");
    const threads = await runtime.messagingRouterService.listThreadLinks(
      runtime.opengoatPaths,
      connectionId,
    );
    return context.json(threads);
  });

  return app;
}
