import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
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
  installSkillRequestSchema,
  installSkillResultSchema,
  removeSkillResultSchema,
  skillListSchema,
  updateAgentRequestSchema,
  updateAgentSessionRequestSchema,
  workspaceFileCheckSchema,
  workspaceFileContentSchema,
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
import { syncAuthProfilesToAgent } from "../../auth/sync.ts";
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
      description: projectUrl,
      instructions: "You are a helpful assistant.",
      name: displayName,
      setAsDefault: true,
      workspaceDir,
    } as CreateAgentRequest);

    // Sync auth profiles from the default agent directory to the new agent.
    // The auth service writes credentials to the DEFAULT_AGENT_ID agent dir,
    // but OpenClaw looks for auth-profiles.json per agent dir.
    syncAuthProfilesToAgent(runtime.gatewaySupervisor.paths, agentId);

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

  app.get("/:agentId/workspace/files/:filename/content", async (context) => {
    const agentId = context.req.param("agentId");
    const filename = context.req.param("filename");

    if (filename.includes("/") || filename.includes("..")) {
      return context.json({ error: "Invalid filename." }, 400);
    }

    const agent = await runtime.embeddedGateway.getAgent(agentId);
    const filePath = join(agent.workspaceDir, filename);
    const exists = existsSync(filePath);
    const content = exists ? readFileSync(filePath, "utf8") : "";

    return context.json(workspaceFileContentSchema.parse({ exists, content }));
  });

  app.put("/:agentId/workspace/files/:filename/content", async (context) => {
    const agentId = context.req.param("agentId");
    const filename = context.req.param("filename");

    if (filename.includes("/") || filename.includes("..")) {
      return context.json({ error: "Invalid filename." }, 400);
    }

    const body = await context.req.json();
    const content = typeof body.content === "string" ? body.content : "";

    const agent = await runtime.embeddedGateway.getAgent(agentId);
    const filePath = join(agent.workspaceDir, filename);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf8");

    return context.json(workspaceFileContentSchema.parse({ exists: true, content }));
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

  // ---- Skill management ----

  app.get("/:agentId/skills", async (context) => {
    const agentId = context.req.param("agentId");
    const skills = await runtime.skillService.listSkills(
      runtime.opengoatPaths,
      agentId,
    );
    return context.json(
      skillListSchema.parse({
        skills: skills.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description || undefined,
          source: s.source,
        })),
      }),
    );
  });

  app.post("/:agentId/skills", async (context) => {
    const agentId = context.req.param("agentId");
    const payload = installSkillRequestSchema.parse(await context.req.json());
    const result = await runtime.skillService.installSkill(
      runtime.opengoatPaths,
      {
        agentId,
        skillName: payload.skillName,
        ...(payload.sourceUrl ? { sourceUrl: payload.sourceUrl } : {}),
      },
    );
    return context.json(
      installSkillResultSchema.parse({
        skillId: result.skillId,
        skillName: result.skillName,
        source: result.source,
        installed: true,
      }),
      201,
    );
  });

  app.delete("/:agentId/skills/:skillId", async (context) => {
    const agentId = context.req.param("agentId");
    const skillId = context.req.param("skillId");
    await runtime.skillService.removeSkill(runtime.opengoatPaths, {
      agentId,
      skillId,
    });
    return context.json(
      removeSkillResultSchema.parse({
        skillId,
        removed: true,
      }),
    );
  });

  return app;
}
