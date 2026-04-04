import { z } from "zod";
import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

const startPlaybookBodySchema = z.object({
  projectId: z.string().min(1),
  objectiveId: z.string().min(1),
});

export function createPlaybookRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.get("/", (context) => {
    const playbooks = runtime.playbookRegistryService.listPlaybooks();
    return context.json({ playbooks });
  });

  app.get("/:playbookId", (context) => {
    const playbookId = context.req.param("playbookId");

    try {
      const playbook = runtime.playbookRegistryService.getPlaybook(playbookId);
      return context.json(playbook);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  // POST /:playbookId/start — start a playbook execution
  app.post("/:playbookId/start", async (context) => {
    const playbookId = context.req.param("playbookId");
    const body = startPlaybookBodySchema.parse(await context.req.json());

    try {
      const run = await runtime.playbookExecutionService.startPlaybook(
        runtime.opengoatPaths,
        {
          playbookId,
          projectId: body.projectId,
          objectiveId: body.objectiveId,
        },
      );
      return context.json(run, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  return app;
}
