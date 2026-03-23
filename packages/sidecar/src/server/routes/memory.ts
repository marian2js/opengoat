import {
  createMemoryRequestSchema,
  resolveConflictRequestSchema,
  updateMemoryRequestSchema,
} from "@opengoat/contracts";
import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

export function createMemoryRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.get("/", async (context) => {
    const projectId = context.req.query("projectId");
    if (!projectId) {
      return context.json({ error: "projectId query parameter is required" }, 400);
    }

    const objectiveId = context.req.query("objectiveId") || undefined;
    const category = context.req.query("category") || undefined;
    const scope = context.req.query("scope") || undefined;
    const activeOnlyParam = context.req.query("activeOnly");
    const activeOnly = activeOnlyParam === "false" ? false : undefined;

    const result = await runtime.memoryService.listMemories(
      runtime.opengoatPaths,
      { projectId, objectiveId, category, scope, activeOnly },
    );

    return context.json(result);
  });

  app.post("/conflicts/resolve", async (context) => {
    try {
      const body = resolveConflictRequestSchema.parse(await context.req.json());
      await runtime.memoryService.resolveConflict(
        runtime.opengoatPaths,
        body.keepMemoryId,
        body.replaceMemoryId,
      );
      return context.json({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return context.json({ error: error.message }, 404);
      }
      if (error instanceof Error && error.name === "ZodError") {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  app.get("/:memoryId", async (context) => {
    const memoryId = context.req.param("memoryId");

    const result = await runtime.memoryService.getMemory(
      runtime.opengoatPaths,
      memoryId,
    );

    if (!result) {
      return context.json({ error: "Memory entry not found" }, 404);
    }

    return context.json(result);
  });

  app.post("/", async (context) => {
    try {
      const body = createMemoryRequestSchema.parse(await context.req.json());
      const result = await runtime.memoryService.createMemory(
        runtime.opengoatPaths,
        body,
      );
      return context.json(result, 201);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  app.patch("/:memoryId", async (context) => {
    const memoryId = context.req.param("memoryId");

    try {
      const body = updateMemoryRequestSchema.parse(await context.req.json());
      const result = await runtime.memoryService.updateMemory(
        runtime.opengoatPaths,
        memoryId,
        body,
      );
      return context.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return context.json({ error: error.message }, 404);
      }
      if (error instanceof Error && error.name === "ZodError") {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  app.delete("/:memoryId", async (context) => {
    const memoryId = context.req.param("memoryId");

    try {
      await runtime.memoryService.deleteMemory(
        runtime.opengoatPaths,
        memoryId,
      );
      return context.body(null, 204);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  return app;
}
