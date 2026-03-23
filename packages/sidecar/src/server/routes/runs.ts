import {
  advanceRunPhaseRequestSchema,
  createRunRequestSchema,
  updateRunStatusRequestSchema,
} from "@opengoat/contracts";
import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

export function createRunRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  // GET / — list runs with optional filters
  app.get("/", async (context) => {
    const projectId = context.req.query("projectId") || undefined;
    const objectiveId = context.req.query("objectiveId") || undefined;
    const status = context.req.query("status") || undefined;
    const limitParam = context.req.query("limit");
    const offsetParam = context.req.query("offset");

    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : undefined;

    const result = await runtime.runService.listRuns(
      runtime.opengoatPaths,
      { projectId, objectiveId, status: status as undefined, limit, offset },
    );

    return context.json(result);
  });

  // GET /:runId — get a single run
  app.get("/:runId", async (context) => {
    const runId = context.req.param("runId");
    try {
      const run = await runtime.runService.getRun(
        runtime.opengoatPaths,
        runId,
      );
      return context.json(run);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  // POST / — create a new run
  app.post("/", async (context) => {
    const body = createRunRequestSchema.parse(await context.req.json());
    const run = await runtime.runService.createRun(
      runtime.opengoatPaths,
      body,
    );
    return context.json(run, 201);
  });

  // PATCH /:runId/status — update run status
  app.patch("/:runId/status", async (context) => {
    const runId = context.req.param("runId");
    const body = updateRunStatusRequestSchema.parse(await context.req.json());

    try {
      const run = await runtime.runService.updateRunStatus(
        runtime.opengoatPaths,
        runId,
        body.status,
      );
      return context.json(run);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return context.json({ error: error.message }, 404);
        }
        if (error.message.includes("Invalid status transition")) {
          return context.json({ error: error.message }, 400);
        }
      }
      throw error;
    }
  });

  // POST /:runId/advance-phase — advance the run's phase
  app.post("/:runId/advance-phase", async (context) => {
    const runId = context.req.param("runId");
    const body = advanceRunPhaseRequestSchema.parse(await context.req.json());

    try {
      const run = await runtime.runService.advancePhase(
        runtime.opengoatPaths,
        runId,
        body,
      );
      return context.json(run);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return context.json({ error: error.message }, 404);
        }
        if (
          error.message.includes("Can only advance phase") ||
          error.message.includes("Phase name must not be empty")
        ) {
          return context.json({ error: error.message }, 400);
        }
      }
      throw error;
    }
  });

  return app;
}
