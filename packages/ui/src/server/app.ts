import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import middie from "@fastify/middie";
import fastifyStatic from "@fastify/static";
import { createServer as createViteServer } from "vite";
import { createOpenGoatRuntime } from "@opengoat/core";

const DEFAULT_AGENT_ID = "goat";
const execFileAsync = promisify(execFile);

interface AgentDescriptor {
  id: string;
  displayName: string;
  workspaceDir: string;
  internalConfigDir: string;
}

interface OrganizationAgent extends AgentDescriptor {
  reportsTo: string | null;
  type: "manager" | "individual" | "unknown";
}

interface AgentCreationResult {
  agent: AgentDescriptor;
  createdPaths: string[];
  skippedPaths: string[];
  alreadyExisted?: boolean;
}

interface AgentDeletionResult {
  agentId: string;
  existed: boolean;
  removedPaths: string[];
  skippedPaths: string[];
}

interface CreateAgentOptions {
  type?: "manager" | "individual";
  reportsTo?: string | null;
  skills?: string[];
}

interface DeleteAgentOptions {
  force?: boolean;
}

interface SessionSummary {
  sessionKey: string;
  sessionId: string;
  title: string;
  updatedAt: number;
  transcriptPath: string;
  workspacePath: string;
  workingPath?: string;
  inputChars: number;
  outputChars: number;
  totalChars: number;
  compactionCount: number;
}

interface ResolvedSkill {
  id: string;
  name: string;
  description: string;
  source: string;
}

export interface OpenClawUiService {
  initialize?: () => Promise<unknown>;
  getHomeDir: () => string;
  getPaths?: () => unknown;
  listAgents: () => Promise<AgentDescriptor[]>;
  createAgent: (name: string, options?: Record<string, unknown>) => Promise<AgentCreationResult>;
  deleteAgent: (agentId: string, options?: Record<string, unknown>) => Promise<AgentDeletionResult>;
  listSessions: (agentId?: string, options?: { activeMinutes?: number }) => Promise<SessionSummary[]>;
  listSkills: (agentId?: string) => Promise<ResolvedSkill[]>;
  listGlobalSkills: () => Promise<ResolvedSkill[]>;
  prepareSession?: (
    agentId?: string,
    options?: { sessionRef?: string; workingPath?: string; forceNew?: boolean }
  ) => Promise<SessionRunInfo>;
  runAgent?: (
    agentId: string,
    options: { message: string; sessionRef?: string; cwd?: string }
  ) => Promise<AgentRunResult>;
  renameSession?: (agentId?: string, title?: string, sessionRef?: string) => Promise<SessionSummary>;
  removeSession?: (agentId?: string, sessionRef?: string) => Promise<SessionRemoveResult>;
}

interface SessionRunInfo {
  agentId: string;
  sessionKey: string;
  sessionId: string;
  transcriptPath: string;
  workspacePath: string;
  workingPath: string;
  isNewSession: boolean;
}

interface LegacyPreparedSessionRun {
  enabled: boolean;
  info?: SessionRunInfo;
}

interface SessionRemoveResult {
  sessionKey: string;
  sessionId: string;
  title: string;
  transcriptPath: string;
}

interface AgentRunResult {
  code: number;
  stdout: string;
  stderr: string;
  providerId: string;
  providerSessionId?: string;
  session?: SessionRunInfo & {
    preRunCompactionApplied: boolean;
    postRunCompaction: {
      compactedMessages: number;
      summary?: string;
    };
  };
}

export interface OpenGoatUiServerOptions {
  logger?: boolean;
  mode?: "development" | "production";
  service?: OpenClawUiService;
  attachFrontend?: boolean;
}

export async function createOpenGoatUiServer(options: OpenGoatUiServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true });
  const runtime = options.service ? undefined : createOpenGoatRuntime();
  const service = options.service ?? runtime?.service;
  const mode = options.mode ?? resolveMode();
  const attachFrontend = options.attachFrontend ?? true;
  const packageRoot = resolvePackageRoot();

  if (!service) {
    throw new Error("OpenGoat UI service is unavailable.");
  }

  if (typeof service.initialize === "function") {
    await service.initialize();
  }

  await app.register(cors, { origin: true });
  registerApiRoutes(app, service, mode);

  if (attachFrontend) {
    await registerFrontend(app, {
      packageRoot,
      mode
    });
  }

  return app;
}

function registerApiRoutes(app: FastifyInstance, service: OpenClawUiService, mode: "development" | "production"): void {
  app.get("/api/health", async (_request, reply) => {
    return safeReply(reply, async () => {
      return {
        ok: true,
        mode,
        homeDir: service.getHomeDir(),
        timestamp: new Date().toISOString()
      };
    });
  });

  app.get("/api/openclaw/overview", async (_request, reply) => {
    return safeReply(reply, async () => {
      const agents = await resolveOrganizationAgents(service);

      return {
        agents,
        totals: {
          agents: agents.length
        }
      };
    });
  });

  app.get("/api/agents", async (_request, reply) => {
    return safeReply(reply, async () => {
      return {
        agents: await resolveOrganizationAgents(service)
      };
    });
  });

  app.post<{ Body: { name?: string; type?: "manager" | "individual"; reportsTo?: string | null; skills?: string[] | string } }>(
    "/api/agents",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const name = request.body?.name?.trim();
        if (!name) {
          reply.code(400);
          return {
            error: "name is required"
          };
        }

        const skills = normalizeSkills(request.body?.skills);
        const created = await service.createAgent(name, {
          type: request.body?.type,
          reportsTo: normalizeReportsTo(request.body?.reportsTo),
          skills
        } satisfies CreateAgentOptions);

        return {
          agent: created.agent,
          created,
          message: created.alreadyExisted
            ? `Agent \"${created.agent.id}\" already exists.`
            : `Agent \"${created.agent.id}\" created.`
        };
      });
    }
  );

  app.delete<{ Params: { agentId: string }; Querystring: { force?: string } }>("/api/agents/:agentId", async (request, reply) => {
    return safeReply(reply, async () => {
      const force = request.query.force === "1" || request.query.force === "true";
      const removed = await service.deleteAgent(request.params.agentId, { force } satisfies DeleteAgentOptions);
      return {
        removed
      };
    });
  });

  app.get<{ Querystring: { agentId?: string } }>("/api/sessions", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.query.agentId?.trim() || DEFAULT_AGENT_ID;
      return {
        agentId,
        sessions: await service.listSessions(agentId)
      };
    });
  });

  app.get<{ Querystring: { agentId?: string; global?: string } }>("/api/skills", async (request, reply) => {
    return safeReply(reply, async () => {
      const global = request.query.global === "1" || request.query.global === "true";
      if (global) {
        return {
          scope: "global",
          skills: await service.listGlobalSkills()
        };
      }

      const agentId = request.query.agentId?.trim() || DEFAULT_AGENT_ID;
      return {
        scope: "agent",
        agentId,
        skills: await service.listSkills(agentId)
      };
    });
  });

  app.post<{ Body: { agentId?: string; folderName?: string; folderPath?: string } }>("/api/projects", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const project = await resolveProjectFolder(request.body?.folderName, request.body?.folderPath);
      const projectSessionRef = buildProjectSessionRef(project.name, project.path);
      await prepareProjectSession(service, agentId, {
        sessionRef: projectSessionRef,
        workingPath: project.path,
        forceNew: false
      });
      await renameUiSession(service, agentId, project.name, projectSessionRef);

      const workspaceSessionRef = buildWorkspaceSessionRef(project.name, project.path);
      const prepared = await prepareProjectSession(service, agentId, {
        sessionRef: workspaceSessionRef,
        workingPath: project.path,
        forceNew: true
      });
      await renameUiSession(service, agentId, resolveDefaultWorkspaceSessionTitle(), workspaceSessionRef);

      return {
        agentId,
        project: {
          name: project.name,
          path: project.path,
          sessionRef: projectSessionRef
        },
        session: prepared,
        message: `Project \"${project.name}\" added and session created.`
      };
    });
  });

  app.post("/api/projects/pick", async (_request, reply) => {
    return safeReply(reply, async () => {
      const project = await pickProjectFolderFromSystem();
      return {
        project
      };
    });
  });

  app.post<{ Body: { agentId?: string; workingPath?: string; workspaceName?: string } }>(
    "/api/workspaces/session",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
        const workingPath = request.body?.workingPath?.trim();
        if (!workingPath) {
          reply.code(400);
          return {
            error: "workingPath is required"
          };
        }

        const resolvedWorkingPath = path.resolve(workingPath);
        const stats = await stat(resolvedWorkingPath).catch(() => {
          return null;
        });
        if (!stats || !stats.isDirectory()) {
          throw new Error(`Workspace path is not a directory: ${resolvedWorkingPath}`);
        }

        const workspaceName = request.body?.workspaceName?.trim() || path.basename(resolvedWorkingPath);
        const sessionRef = buildWorkspaceSessionRef(workspaceName, resolvedWorkingPath);
        const prepared = await prepareProjectSession(service, agentId, {
          sessionRef,
          workingPath: resolvedWorkingPath,
          forceNew: true
        });

        const summary = await renameUiSession(service, agentId, resolveDefaultWorkspaceSessionTitle(), sessionRef);

        return {
          agentId,
          session: prepared,
          summary,
          message: `Session created in \"${workspaceName}\".`
        };
      });
    }
  );

  app.post<{ Body: { agentId?: string; sessionRef?: string; name?: string } }>("/api/workspaces/rename", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      const name = request.body?.name?.trim();
      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }
      if (!name) {
        reply.code(400);
        return {
          error: "name is required"
        };
      }

      const renamed = await renameUiSession(service, agentId, name, sessionRef);
      return {
        agentId,
        workspace: {
          name: renamed.title,
          sessionRef
        },
        message: `Workspace renamed to \"${renamed.title}\".`
      };
    });
  });

  app.post<{ Body: { agentId?: string; sessionRef?: string } }>("/api/workspaces/delete", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }

      const removed = await removeUiSession(service, agentId, sessionRef);

      return {
        agentId,
        removedWorkspace: {
          sessionRef: removed.sessionKey
        },
        message: "Workspace removed."
      };
    });
  });

  app.post<{ Body: { agentId?: string; sessionRef?: string } }>("/api/sessions/remove", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }

      const removed = await removeUiSession(service, agentId, sessionRef);
      return {
        agentId,
        removedSession: {
          sessionRef: removed.sessionKey
        },
        message: "Session removed."
      };
    });
  });

  app.post<{ Body: { agentId?: string; sessionRef?: string; name?: string } }>("/api/sessions/rename", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      const name = request.body?.name?.trim();
      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }
      if (!name) {
        reply.code(400);
        return {
          error: "name is required"
        };
      }

      const renamed = await renameUiSession(service, agentId, name, sessionRef);
      return {
        agentId,
        session: {
          name: renamed.title,
          sessionRef
        },
        message: `Session renamed to \"${renamed.title}\".`
      };
    });
  });

  const handleSessionMessage = async (
    request: { body?: { agentId?: string; sessionRef?: string; workingPath?: string; message?: string } },
    reply: FastifyReply
  ): Promise<unknown> => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      const message = request.body?.message?.trim();
      const workingPath = request.body?.workingPath?.trim();

      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }

      if (!message) {
        reply.code(400);
        return {
          error: "message is required"
        };
      }

      const result = await runUiSessionMessage(service, agentId, {
        sessionRef,
        workingPath,
        message
      });

      const output = result.stdout.trim() || result.stderr.trim();

      return {
        agentId,
        sessionRef,
        output,
        result: {
          code: result.code,
          stdout: result.stdout,
          stderr: result.stderr
        },
        message: result.code === 0 ? "Message sent." : "Message completed with non-zero exit code."
      };
    });
  };

  app.post<{ Body: { agentId?: string; sessionRef?: string; workingPath?: string; message?: string } }>(
    "/api/sessions/message",
    handleSessionMessage
  );
  app.post<{ Body: { agentId?: string; sessionRef?: string; workingPath?: string; message?: string } }>(
    "/api/session/message",
    handleSessionMessage
  );

}

interface FrontendOptions {
  packageRoot: string;
  mode: "development" | "production";
}

async function registerFrontend(app: FastifyInstance, options: FrontendOptions): Promise<void> {
  const indexPath = path.resolve(options.packageRoot, "index.html");

  if (options.mode === "development") {
    await app.register(middie);

    const vite = await createViteServer({
      root: options.packageRoot,
      appType: "custom",
      server: {
        middlewareMode: true
      }
    });

    app.use(vite.middlewares);
    app.addHook("onClose", async () => {
      await vite.close();
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not Found" });
      }

      const template = await readFile(indexPath, "utf8");
      const html = await vite.transformIndexHtml(request.raw.url ?? "/", template);
      return reply.type("text/html").send(html);
    });

    return;
  }

  const clientDist = path.resolve(options.packageRoot, "dist/client");
  await app.register(fastifyStatic, {
    root: clientDist,
    prefix: "/",
    decorateReply: false
  });

  const staticIndexPath = path.resolve(clientDist, "index.html");
  const fallbackTemplate = existsSync(staticIndexPath)
    ? await readFile(staticIndexPath, "utf8")
    : "<!doctype html><html><body><h1>OpenGoat UI build not found</h1></body></html>";

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not Found" });
    }
    return reply.type("text/html").send(fallbackTemplate);
  });
}

function resolveMode(): "development" | "production" {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

function resolvePackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return path.resolve(currentDir, "../..");
}

function normalizeReportsTo(value: string | null | undefined): string | null | undefined {
  if (value === null) {
    return null;
  }

  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === "none") {
    return undefined;
  }

  return normalized;
}

function normalizeSkills(value: string[] | string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

async function prepareProjectSession(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    workingPath: string;
    forceNew: boolean;
  }
): Promise<SessionRunInfo> {
  if (typeof service.prepareSession === "function") {
    return service.prepareSession(agentId, options);
  }

  // Backward-compatible path: older @opengoat/core builds don't expose prepareSession
  // but still expose getPaths() and sessionService.prepareRunSession(...) on the service instance.
  const legacy = service as OpenClawUiService & {
    sessionService?: {
      prepareRunSession?: (
        paths: unknown,
        legacyAgentId: string,
        request: { sessionRef?: string; forceNew?: boolean; workingPath?: string; userMessage: string }
      ) => Promise<LegacyPreparedSessionRun>;
      renameSession?: (paths: unknown, legacyAgentId: string, title: string, sessionRef?: string) => Promise<SessionSummary>;
      removeSession?: (paths: unknown, legacyAgentId: string, sessionRef?: string) => Promise<SessionRemoveResult>;
    };
  };

  if (typeof legacy.getPaths === "function" && typeof legacy.sessionService?.prepareRunSession === "function") {
    const prepared = await legacy.sessionService.prepareRunSession(legacy.getPaths(), agentId, {
      sessionRef: options.sessionRef,
      forceNew: options.forceNew,
      workingPath: options.workingPath,
      userMessage: ""
    });

    if (!prepared.enabled || !prepared.info) {
      throw new Error("Session preparation was disabled.");
    }
    return prepared.info;
  }

  throw new Error("Project session preparation is unavailable. Restart the UI server after updating dependencies.");
}

async function renameUiSession(
  service: OpenClawUiService,
  agentId: string,
  title: string,
  sessionRef: string
): Promise<SessionSummary> {
  if (typeof service.renameSession === "function") {
    return service.renameSession(agentId, title, sessionRef);
  }

  const legacy = service as OpenClawUiService & {
    sessionService?: {
      renameSession?: (paths: unknown, legacyAgentId: string, nextTitle: string, legacySessionRef?: string) => Promise<SessionSummary>;
    };
  };
  if (typeof legacy.getPaths === "function" && typeof legacy.sessionService?.renameSession === "function") {
    return legacy.sessionService.renameSession(legacy.getPaths(), agentId, title, sessionRef);
  }

  throw new Error("Session rename is unavailable on this runtime.");
}

async function removeUiSession(
  service: OpenClawUiService,
  agentId: string,
  sessionRef: string
): Promise<SessionRemoveResult> {
  if (typeof service.removeSession === "function") {
    return service.removeSession(agentId, sessionRef);
  }

  const legacy = service as OpenClawUiService & {
    sessionService?: {
      removeSession?: (paths: unknown, legacyAgentId: string, legacySessionRef?: string) => Promise<SessionRemoveResult>;
    };
  };
  if (typeof legacy.getPaths === "function" && typeof legacy.sessionService?.removeSession === "function") {
    return legacy.sessionService.removeSession(legacy.getPaths(), agentId, sessionRef);
  }

  throw new Error("Session removal is unavailable on this runtime.");
}

async function runUiSessionMessage(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    workingPath?: string;
    message: string;
  }
): Promise<AgentRunResult> {
  if (typeof service.runAgent === "function") {
    return service.runAgent(agentId, {
      message: options.message,
      sessionRef: options.sessionRef,
      cwd: options.workingPath
    });
  }

  throw new Error("Session messaging is unavailable on this runtime.");
}

async function resolveProjectFolder(
  folderName: string | undefined,
  folderPath: string | undefined
): Promise<{ name: string; path: string }> {
  const explicitPath = folderPath?.trim();
  if (explicitPath) {
    const resolvedPath = path.resolve(explicitPath);
    const stats = await stat(resolvedPath).catch(() => {
      return null;
    });
    if (!stats || !stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${resolvedPath}`);
    }

    const explicitName = folderName?.trim();
    return {
      name: explicitName || path.basename(resolvedPath),
      path: resolvedPath
    };
  }

  const normalizedFolderName = normalizeDesktopFolderName(folderName);
  if (!normalizedFolderName) {
    throw new Error("folderName is required.");
  }

  const desktopDir = path.resolve(homedir(), "Desktop");
  const projectPath = path.resolve(desktopDir, normalizedFolderName);
  const stats = await stat(projectPath).catch(() => {
    return null;
  });
  if (!stats || !stats.isDirectory()) {
    throw new Error(`Desktop folder does not exist: ${projectPath}`);
  }

  return {
    name: normalizedFolderName,
    path: projectPath
  };
}

function normalizeDesktopFolderName(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === "." || trimmed === "..") {
    return null;
  }

  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    return null;
  }

  return trimmed;
}

function buildProjectSessionRef(projectName: string, projectPath: string): string {
  const segment = normalizeProjectSegment(projectName);
  const suffix = normalizeProjectSegment(projectPath).slice(-10) || "session";
  return `project:${segment}-${suffix}`;
}

function buildWorkspaceSessionRef(workspaceName: string, workspacePath: string): string {
  const segment = normalizeProjectSegment(workspaceName);
  const suffix = normalizeProjectSegment(workspacePath).slice(-10) || "workspace";
  const nonce = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, "0")}`;
  return `workspace:${segment}-${suffix}-${nonce}`;
}

function resolveDefaultWorkspaceSessionTitle(): string {
  return "New Session";
}

function normalizeProjectSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
}

async function pickProjectFolderFromSystem(): Promise<{ name: string; path: string }> {
  if (process.platform === "darwin") {
    const script = 'POSIX path of (choose folder with prompt "Select a project folder")';
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      timeout: 120_000
    });
    const selectedPath = stdout.trim().replace(/[\\/]+$/, "");
    if (!selectedPath) {
      throw new Error("No folder was selected.");
    }
    const resolvedPath = path.resolve(selectedPath);
    const stats = await stat(resolvedPath).catch(() => {
      return null;
    });
    if (!stats || !stats.isDirectory()) {
      throw new Error(`Selected folder is not accessible: ${resolvedPath}`);
    }
    return {
      name: path.basename(resolvedPath),
      path: resolvedPath
    };
  }

  throw new Error("Native folder picker is currently supported on macOS only.");
}

async function resolveOrganizationAgents(service: OpenClawUiService): Promise<OrganizationAgent[]> {
  const agents = await service.listAgents();
  const agentIds = new Set(agents.map((agent) => agent.id));

  return Promise.all(
    agents.map(async (agent) => {
      const fallbackReportsTo = agent.id === DEFAULT_AGENT_ID ? null : DEFAULT_AGENT_ID;
      const fallbackType: OrganizationAgent["type"] = agent.id === DEFAULT_AGENT_ID ? "manager" : "individual";

      try {
        const configPath = path.resolve(agent.internalConfigDir, "config.json");
        const raw = await readFile(configPath, "utf8");
        const parsed = JSON.parse(raw) as {
          organization?: {
            reportsTo?: string | null;
            type?: string;
          };
        };

        const organization = parsed.organization;
        const reportsTo = normalizeReportsToValue(organization?.reportsTo, fallbackReportsTo, agentIds);
        const type = normalizeTypeValue(organization?.type, fallbackType);

        return {
          ...agent,
          reportsTo,
          type
        };
      } catch {
        return {
          ...agent,
          reportsTo: fallbackReportsTo,
          type: fallbackType
        };
      }
    })
  );
}

function normalizeReportsToValue(
  value: string | null | undefined,
  fallback: string | null,
  knownAgentIds: Set<string>
): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "null" || normalized === "none") {
    return null;
  }

  return knownAgentIds.has(normalized) ? normalized : fallback;
}

function normalizeTypeValue(rawType: string | undefined, fallback: OrganizationAgent["type"]): OrganizationAgent["type"] {
  const normalized = rawType?.trim().toLowerCase();
  if (normalized === "manager" || normalized === "individual") {
    return normalized;
  }
  return fallback;
}

async function safeReply<T>(reply: FastifyReply, operation: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    reply.code(500);
    return {
      error: message
    };
  }
}
