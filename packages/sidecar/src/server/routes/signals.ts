import {
  createSignalRequestSchema,
  dismissSignalRequestSchema,
  promoteSignalRequestSchema,
  updateSignalStatusRequestSchema,
} from "@opengoat/contracts";
import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

export function createSignalRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.get("/", async (context) => {
    const projectId = context.req.query("projectId") || undefined;
    const objectiveId = context.req.query("objectiveId") || undefined;
    const status = context.req.query("status") || undefined;
    const sourceType = context.req.query("sourceType") || undefined;
    const limitParam = context.req.query("limit");
    const offsetParam = context.req.query("offset");

    if (!projectId) {
      return context.json({ error: "projectId query param is required" }, 400);
    }

    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : undefined;

    const result = await runtime.signalService.listSignals(
      runtime.opengoatPaths,
      { projectId, objectiveId, status, sourceType, limit, offset },
    );

    return context.json(result);
  });

  app.get("/:signalId", async (context) => {
    const signalId = context.req.param("signalId");

    try {
      const signal = await runtime.signalService.getSignal(
        runtime.opengoatPaths,
        signalId,
      );
      return context.json(signal);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("not found") ||
          error.message.includes("does not exist"))
      ) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.post("/", async (context) => {
    const body = createSignalRequestSchema.parse(await context.req.json());

    const signal = await runtime.signalService.createSignal(
      runtime.opengoatPaths,
      body,
    );

    return context.json(signal, 201);
  });

  app.patch("/:signalId/status", async (context) => {
    const signalId = context.req.param("signalId");
    const body = updateSignalStatusRequestSchema.parse(
      await context.req.json(),
    );

    try {
      const signal = await runtime.signalService.updateSignalStatus(
        runtime.opengoatPaths,
        signalId,
        body.status,
      );
      return context.json(signal);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("not found") ||
          error.message.includes("does not exist"))
      ) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.post("/:signalId/promote", async (context) => {
    const signalId = context.req.param("signalId");
    const body = promoteSignalRequestSchema.parse(await context.req.json());

    try {
      const signal = await runtime.signalService.promoteSignal(
        runtime.opengoatPaths,
        signalId,
        body.targetObjectiveId,
      );
      return context.json(signal);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("not found") ||
          error.message.includes("does not exist"))
      ) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.post("/:signalId/dismiss", async (context) => {
    const signalId = context.req.param("signalId");

    try {
      const signal = await runtime.signalService.dismissSignal(
        runtime.opengoatPaths,
        signalId,
      );
      return context.json(signal);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("not found") ||
          error.message.includes("does not exist"))
      ) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  return app;
}
