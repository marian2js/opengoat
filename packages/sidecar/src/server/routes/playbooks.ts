import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

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

  return app;
}
