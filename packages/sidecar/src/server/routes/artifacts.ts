import {
  createArtifactRequestSchema,
  createBundleRequestSchema,
  updateArtifactRequestSchema,
  updateArtifactStatusRequestSchema,
} from "@opengoat/contracts";
import { getSpecialistById } from "@opengoat/core";
import { Hono } from "hono";
import { z } from "zod";
import { extractArtifacts, bundleUnbundledArtifacts } from "../../artifact-extractor/index.ts";
import type { SidecarRuntime } from "../context.ts";

const extractRequestSchema = z.object({
  sessionId: z.string().min(1),
  messageIndex: z.number().int().min(0),
  specialistId: z.string().min(1),
  agentId: z.string().min(1),
});

const DEFAULT_ACTOR_ID = "goat";

export function createArtifactRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.get("/", async (context) => {
    const projectId = context.req.query("projectId") || undefined;
    const objectiveId = context.req.query("objectiveId") || undefined;
    const runId = context.req.query("runId") || undefined;
    const taskId = context.req.query("taskId") || undefined;
    const bundleId = context.req.query("bundleId") || undefined;
    const status = context.req.query("status") || undefined;
    const limitParam = context.req.query("limit");
    const offsetParam = context.req.query("offset");

    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : undefined;

    const result = await runtime.artifactService.listArtifacts(
      runtime.opengoatPaths,
      { projectId, objectiveId, runId, taskId, bundleId, status, limit, offset },
    );

    return context.json(result);
  });

  app.get("/:artifactId/versions", async (context) => {
    const artifactId = context.req.param("artifactId");

    try {
      const versions = await runtime.artifactService.getVersionHistory(
        runtime.opengoatPaths,
        artifactId,
      );
      return context.json(versions);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.get("/:artifactId", async (context) => {
    const artifactId = context.req.param("artifactId");

    try {
      const artifact = await runtime.artifactService.getArtifact(
        runtime.opengoatPaths,
        artifactId,
      );
      return context.json(artifact);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  app.post("/extract", async (context) => {
    const body = extractRequestSchema.parse(await context.req.json());
    const specialist = getSpecialistById(body.specialistId);
    if (!specialist) {
      return context.json({ error: `Specialist "${body.specialistId}" not found` }, 400);
    }

    const bootstrap = await runtime.embeddedGateway.bootstrapConversation(
      body.agentId,
      body.sessionId,
    );

    const message = bootstrap.messages[body.messageIndex];
    if (!message) {
      return context.json({ error: `Message at index ${body.messageIndex} not found` }, 400);
    }
    if (message.role !== "assistant") {
      return context.json({ error: "Message at specified index is not an assistant message" }, 400);
    }

    const text = "text" in message && typeof message.text === "string"
      ? message.text
      : "";

    const result = await extractArtifacts(text, {
      specialistId: body.specialistId,
      agentId: body.agentId,
      sessionId: body.sessionId,
      messageIndex: body.messageIndex,
    }, {
      artifactService: runtime.artifactService,
      opengoatPaths: runtime.opengoatPaths,
      specialist,
    });

    return context.json(result);
  });

  app.post("/", async (context) => {
    const body = createArtifactRequestSchema.parse(await context.req.json());

    const artifact = await runtime.artifactService.createArtifact(
      runtime.opengoatPaths,
      body,
    );

    return context.json(artifact);
  });

  app.patch("/:artifactId/status", async (context) => {
    const artifactId = context.req.param("artifactId");
    const actorId = context.req.header("x-actor-id") || DEFAULT_ACTOR_ID;
    const body = updateArtifactStatusRequestSchema.parse(await context.req.json());

    try {
      const artifact = await runtime.artifactService.updateArtifactStatus(
        runtime.opengoatPaths,
        artifactId,
        body.status,
        body.actor || actorId,
      );
      return context.json(artifact);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      if (error instanceof Error && error.message.includes("Invalid status transition")) {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  app.patch("/:artifactId", async (context) => {
    const artifactId = context.req.param("artifactId");
    const body = updateArtifactRequestSchema.parse(await context.req.json());

    try {
      const artifact = await runtime.artifactService.updateArtifact(
        runtime.opengoatPaths,
        artifactId,
        body,
      );
      return context.json(artifact);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  return app;
}

export function createBundleRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.post("/", async (context) => {
    const body = createBundleRequestSchema.parse(await context.req.json());

    const bundle = await runtime.artifactService.createBundle(
      runtime.opengoatPaths,
      body,
    );

    return context.json(bundle);
  });

  app.post("/group-unbundled", async (context) => {
    const body = z.object({ projectId: z.string().min(1) }).parse(await context.req.json());

    const result = await bundleUnbundledArtifacts(runtime.opengoatPaths, body.projectId, {
      artifactService: runtime.artifactService,
      opengoatPaths: runtime.opengoatPaths,
      specialistLookup: (id) => getSpecialistById(id)?.name ?? id,
    });

    return context.json(result);
  });

  app.get("/:bundleId", async (context) => {
    const bundleId = context.req.param("bundleId");

    try {
      const artifacts = await runtime.artifactService.listBundleArtifacts(
        runtime.opengoatPaths,
        bundleId,
      );
      return context.json(artifacts);
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        return context.json({ error: error.message }, 404);
      }
      throw error;
    }
  });

  return app;
}
