import {
  createObjectiveRequestSchema,
  updateObjectiveRequestSchema,
} from "@opengoat/contracts";
import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

export function createObjectiveRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.post("/", async (context) => {
    const body = await context.req.json();
    const { projectId } = body;

    if (!projectId || typeof projectId !== "string") {
      return context.json({ error: "projectId is required" }, 400);
    }

    const parsed = createObjectiveRequestSchema.parse(body);
    const result = await runtime.objectiveService.create(
      runtime.opengoatPaths,
      projectId,
      parsed,
    );

    return context.json(result, 201);
  });

  app.get("/", async (context) => {
    const projectId = context.req.query("projectId") || undefined;
    const status = context.req.query("status") || undefined;

    if (!projectId) {
      return context.json({ error: "projectId query param is required" }, 400);
    }

    const result = await runtime.objectiveService.list(
      runtime.opengoatPaths,
      { projectId, status },
    );

    return context.json(result);
  });

  app.get("/:objectiveId", async (context) => {
    const objectiveId = context.req.param("objectiveId");

    try {
      const result = await runtime.objectiveService.get(
        runtime.opengoatPaths,
        objectiveId,
      );
      return context.json(result);
    } catch (error) {
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("does not exist"))) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.patch("/:objectiveId", async (context) => {
    const objectiveId = context.req.param("objectiveId");
    const body = updateObjectiveRequestSchema.parse(await context.req.json());

    try {
      const result = await runtime.objectiveService.update(
        runtime.opengoatPaths,
        objectiveId,
        body,
      );
      return context.json(result);
    } catch (error) {
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("does not exist"))) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.post("/:objectiveId/archive", async (context) => {
    const objectiveId = context.req.param("objectiveId");

    try {
      const result = await runtime.objectiveService.archive(
        runtime.opengoatPaths,
        objectiveId,
      );
      return context.json(result);
    } catch (error) {
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("does not exist"))) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.post("/:objectiveId/set-primary", async (context) => {
    const objectiveId = context.req.param("objectiveId");
    const body = await context.req.json();
    const { projectId } = body;

    if (!projectId || typeof projectId !== "string") {
      return context.json({ error: "projectId is required in body" }, 400);
    }

    try {
      const result = await runtime.objectiveService.setPrimaryActive(
        runtime.opengoatPaths,
        projectId,
        objectiveId,
      );
      return context.json(result);
    } catch (error) {
      if (error instanceof Error && (error.message.includes("not found") || error.message.includes("does not exist") || error.message.includes("does not belong"))) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  return app;
}
