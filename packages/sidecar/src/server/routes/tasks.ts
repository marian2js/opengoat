import {
  addTaskArtifactRequestSchema,
  addTaskBlockerRequestSchema,
  addTaskWorklogRequestSchema,
  createTaskFromRunRequestSchema,
  deleteTasksRequestSchema,
  setLeadingTaskRequestSchema,
  updateTaskStatusRequestSchema,
} from "@opengoat/contracts";
import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

const DEFAULT_ACTOR_ID = "goat";

export function createTaskRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.get("/", async (context) => {
    const status = context.req.query("status") || undefined;
    const assignee = context.req.query("assignee") || undefined;
    const objectiveId = context.req.query("objectiveId") || undefined;
    const runId = context.req.query("runId") || undefined;
    const sourceType = context.req.query("sourceType") || undefined;
    const limitParam = context.req.query("limit");
    const offsetParam = context.req.query("offset");

    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : undefined;

    const result = await runtime.boardService.listLatestTasksPage(
      runtime.opengoatPaths,
      { status, assignee, objectiveId, runId, sourceType, limit, offset },
    );

    return context.json(result);
  });

  // ── Leading task ──────────────────────────────────────────────────
  // These routes MUST appear before /:taskId to avoid being caught by it.

  app.get("/leading", async (context) => {
    const task = await runtime.boardService.getLeadingTask(
      runtime.opengoatPaths,
    );

    if (!task) {
      return context.body(null, 204);
    }

    return context.json(task);
  });

  app.put("/leading", async (context) => {
    const body = setLeadingTaskRequestSchema.parse(await context.req.json());

    try {
      const task = await runtime.boardService.setLeadingTask(
        runtime.opengoatPaths,
        body.taskId,
      );
      return context.json(task);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.delete("/leading", async (context) => {
    await runtime.boardService.clearLeadingTask(runtime.opengoatPaths);
    return context.body(null, 204);
  });

  // ── Individual task routes ──────────────────────────────────────────

  app.get("/:taskId", async (context) => {
    const taskId = context.req.param("taskId");

    try {
      const task = await runtime.boardService.getTask(
        runtime.opengoatPaths,
        taskId,
      );
      return context.json(task);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.patch("/:taskId/status", async (context) => {
    const taskId = context.req.param("taskId");
    const actorId = context.req.header("x-actor-id") || DEFAULT_ACTOR_ID;
    const body = updateTaskStatusRequestSchema.parse(await context.req.json());

    try {
      const task = await runtime.boardService.updateTaskStatus(
        runtime.opengoatPaths,
        actorId,
        taskId,
        body.status,
        body.reason,
      );
      return context.json(task);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.post("/:taskId/blockers", async (context) => {
    const taskId = context.req.param("taskId");
    const actorId = context.req.header("x-actor-id") || DEFAULT_ACTOR_ID;
    const body = addTaskBlockerRequestSchema.parse(await context.req.json());

    try {
      const task = await runtime.boardService.addTaskBlocker(
        runtime.opengoatPaths,
        actorId,
        taskId,
        body.content,
      );
      return context.json(task);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.post("/:taskId/artifacts", async (context) => {
    const taskId = context.req.param("taskId");
    const actorId = context.req.header("x-actor-id") || DEFAULT_ACTOR_ID;
    const body = addTaskArtifactRequestSchema.parse(await context.req.json());

    try {
      const task = await runtime.boardService.addTaskArtifact(
        runtime.opengoatPaths,
        actorId,
        taskId,
        body.content,
      );
      return context.json(task);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.post("/:taskId/worklog", async (context) => {
    const taskId = context.req.param("taskId");
    const actorId = context.req.header("x-actor-id") || DEFAULT_ACTOR_ID;
    const body = addTaskWorklogRequestSchema.parse(await context.req.json());

    try {
      const task = await runtime.boardService.addTaskWorklog(
        runtime.opengoatPaths,
        actorId,
        taskId,
        body.content,
      );
      return context.json(task);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.post("/from-run", async (context) => {
    const actorId = context.req.header("x-actor-id") || DEFAULT_ACTOR_ID;
    const body = createTaskFromRunRequestSchema.parse(await context.req.json());

    try {
      const task = await runtime.boardService.createTaskFromRun(
        runtime.opengoatPaths,
        actorId,
        body.runId,
        body.objectiveId,
        {
          title: body.title,
          description: body.description,
          assignedTo: body.assignedTo,
          status: body.status,
        },
      );
      return context.json(task, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.delete("/", async (context) => {
    const actorId = context.req.header("x-actor-id") || DEFAULT_ACTOR_ID;
    const body = deleteTasksRequestSchema.parse(await context.req.json());

    const result = await runtime.boardService.deleteTasks(
      runtime.opengoatPaths,
      actorId,
      body.taskIds,
    );

    return context.json(result);
  });

  return app;
}
