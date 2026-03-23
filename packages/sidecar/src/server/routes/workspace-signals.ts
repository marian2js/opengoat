import { WorkspaceSignalDetector } from "@opengoat/core";
import { Hono } from "hono";
import type { SidecarRuntime } from "../context.ts";

export function createWorkspaceSignalRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.post("/detect", async (context) => {
    const body = await context.req.json();
    const projectId = body?.projectId;

    if (!projectId || typeof projectId !== "string") {
      return context.json({ error: "projectId is required" }, 400);
    }

    const detector = new WorkspaceSignalDetector({
      signalService: runtime.signalService,
      nowIso: () => new Date().toISOString(),
    });

    const result = await detector.detectAndCreateSignals(
      runtime.opengoatPaths,
      projectId,
      { boardService: runtime.boardService },
    );

    return context.json(result);
  });

  return app;
}
