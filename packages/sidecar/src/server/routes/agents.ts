import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  agentCatalogSchema,
  agentSchema,
  agentSessionListSchema,
  agentSessionSchema,
  bootstrapPromptListSchema,
  createAgentRequestSchema,
  createAgentSessionRequestSchema,
  createProjectAgentRequestSchema,
  deleteAgentResponseSchema,
  deleteAgentSessionResponseSchema,
  updateAgentRequestSchema,
  updateAgentSessionRequestSchema,
  workspaceFileCheckSchema,
} from "@opengoat/contracts";
import {
  deriveUniqueProjectId,
  listProjectCmoBootstrapPrompts,
  projectUrlToProjectId,
} from "@opengoat/core";
import { Hono } from "hono";
import type {
  CreateAgentRequest,
  UpdateAgentRequest,
} from "../types.ts";
import type { SidecarRuntime } from "../context.ts";

const BOOTSTRAP_EXPECTED_FILES: Record<string, string> = {
  product: "PRODUCT.md",
  market: "MARKET.md",
  growth: "GROWTH.md",
};

export function createAgentRoutes(runtime: SidecarRuntime): Hono {
  const app = new Hono();

  app.get("/", async (context) => {
    const catalog = await runtime.embeddedGateway.getCatalog();
    return context.json(agentCatalogSchema.parse(catalog));
  });

  app.post("/", async (context) => {
    const payload = createAgentRequestSchema.parse(await context.req.json());
    const agent = await runtime.embeddedGateway.createAgent(
      payload as CreateAgentRequest,
    );
    return context.json(agentSchema.parse(agent), 201);
  });

  app.post("/project", async (context) => {
    const { projectUrl } = createProjectAgentRequestSchema.parse(await context.req.json());
    const baseProjectId = projectUrlToProjectId(projectUrl);
    const catalog = await runtime.embeddedGateway.getCatalog();
    const existingIds = new Set(catalog.agents.map((a) => a.id.replace(/-main$/, "")));
    const projectId = deriveUniqueProjectId(baseProjectId, existingIds);
    const agentId = `${projectId}-main`;
    const workspacesDir = runtime.gatewaySupervisor.paths.workspacesDir;
    const workspaceDir = join(workspacesDir, projectId, agentId);
    const displayName = projectId.charAt(0).toUpperCase() + projectId.slice(1);

    const agent = await runtime.embeddedGateway.createAgent({
      id: agentId,
      instructions: "You are a helpful assistant.",
      name: displayName,
      setAsDefault: true,
      workspaceDir,
    } as CreateAgentRequest);

    return context.json(agentSchema.parse(agent), 201);
  });

  app.get("/:agentId/bootstrap-prompts", async (context) => {
    const projectUrl = context.req.query("projectUrl")?.trim();
    if (!projectUrl) {
      return context.json({ error: "projectUrl query parameter is required." }, 400);
    }

    const prompts = listProjectCmoBootstrapPrompts(projectUrl).map((prompt) => ({
      ...prompt,
      expectedFile: BOOTSTRAP_EXPECTED_FILES[prompt.id] ?? `${prompt.id.toUpperCase()}.md`,
    }));

    return context.json(bootstrapPromptListSchema.parse({ prompts }));
  });

  app.get("/:agentId/workspace/files/:filename", async (context) => {
    const agentId = context.req.param("agentId");
    const filename = context.req.param("filename");

    if (filename.includes("/") || filename.includes("..")) {
      return context.json({ error: "Invalid filename." }, 400);
    }

    const agent = await runtime.embeddedGateway.getAgent(agentId);
    const filePath = join(agent.workspaceDir, filename);
    const exists = existsSync(filePath);

    return context.json(workspaceFileCheckSchema.parse({ exists }));
  });

  app.patch("/:agentId", async (context) => {
    const payload = updateAgentRequestSchema.parse(await context.req.json());
    const agent = await runtime.embeddedGateway.updateAgent(
      context.req.param("agentId"),
      payload as UpdateAgentRequest,
    );
    return context.json(agentSchema.parse(agent));
  });

  app.delete("/:agentId", async (context) => {
    const summary = await runtime.embeddedGateway.deleteAgent(
      context.req.param("agentId"),
    );
    return context.json(deleteAgentResponseSchema.parse(summary));
  });

  app.get("/sessions", async (context) => {
    const agentId = context.req.query("agentId")?.trim();
    const sessions = await runtime.embeddedGateway.listSessions(agentId);
    return context.json(agentSessionListSchema.parse(sessions));
  });

  app.post("/sessions", async (context) => {
    const payload = createAgentSessionRequestSchema.parse(await context.req.json());
    const session = await runtime.embeddedGateway.createSession(payload);
    return context.json(agentSessionSchema.parse(session), 201);
  });

  app.delete("/sessions/:sessionId", async (context) => {
    const result = await runtime.embeddedGateway.deleteSession(
      context.req.param("sessionId"),
    );
    return context.json(deleteAgentSessionResponseSchema.parse(result));
  });

  app.patch("/sessions/:sessionId", async (context) => {
    const payload = updateAgentSessionRequestSchema.parse(await context.req.json());
    const session = await runtime.embeddedGateway.updateSessionLabel(
      context.req.param("sessionId"),
      payload.label,
    );
    return context.json(agentSessionSchema.parse(session));
  });

  return app;
}
