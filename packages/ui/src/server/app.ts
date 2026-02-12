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

const DEFAULT_AGENT_ID = "ceo";
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
  role?: string;
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
  role?: string;
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
  projectPath?: string;
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

interface UiImageInput {
  dataUrl?: string;
  mediaType?: string;
  name?: string;
}

export interface OpenClawUiService {
  initialize?: () => Promise<unknown>;
  getHomeDir: () => string;
  getPaths?: () => unknown;
  listAgents: () => Promise<AgentDescriptor[]>;
  createAgent: (name: string, options?: CreateAgentOptions) => Promise<AgentCreationResult>;
  deleteAgent: (agentId: string, options?: Record<string, unknown>) => Promise<AgentDeletionResult>;
  listSessions: (agentId?: string, options?: { activeMinutes?: number }) => Promise<SessionSummary[]>;
  listSkills: (agentId?: string) => Promise<ResolvedSkill[]>;
  listGlobalSkills: () => Promise<ResolvedSkill[]>;
  prepareSession?: (
    agentId?: string,
    options?: { sessionRef?: string; projectPath?: string; forceNew?: boolean }
  ) => Promise<SessionRunInfo>;
  runAgent?: (
    agentId: string,
    options: { message: string; sessionRef?: string; cwd?: string; images?: UiImageInput[] }
  ) => Promise<AgentRunResult>;
  getSessionHistory?: (
    agentId?: string,
    options?: { sessionRef?: string; limit?: number; includeCompaction?: boolean }
  ) => Promise<SessionHistoryResult>;
  renameSession?: (agentId?: string, title?: string, sessionRef?: string) => Promise<SessionSummary>;
  removeSession?: (agentId?: string, sessionRef?: string) => Promise<SessionRemoveResult>;
  createBoard?: (actorId: string, options: { title: string }) => Promise<BoardSummary>;
  listBoards?: () => Promise<BoardSummary[]>;
  getBoard?: (boardId: string) => Promise<BoardRecord>;
  updateBoard?: (actorId: string, boardId: string, options: { title?: string }) => Promise<BoardSummary>;
  createTask?: (
    actorId: string,
    boardId: string,
    options: {
      title: string;
      description: string;
      project?: string;
      assignedTo?: string;
      status?: string;
    }
  ) => Promise<TaskRecord>;
  listTasks?: (boardId: string) => Promise<TaskRecord[]>;
  getTask?: (taskId: string) => Promise<TaskRecord>;
  updateTaskStatus?: (actorId: string, taskId: string, status: string, reason?: string) => Promise<TaskRecord>;
  addTaskBlocker?: (actorId: string, taskId: string, blocker: string) => Promise<TaskRecord>;
  addTaskArtifact?: (actorId: string, taskId: string, content: string) => Promise<TaskRecord>;
  addTaskWorklog?: (actorId: string, taskId: string, content: string) => Promise<TaskRecord>;
}

interface SessionRunInfo {
  agentId: string;
  sessionKey: string;
  sessionId: string;
  transcriptPath: string;
  workspacePath: string;
  projectPath: string;
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

interface SessionHistoryItem {
  type: "message" | "compaction";
  role?: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface SessionHistoryResult {
  sessionKey: string;
  sessionId?: string;
  transcriptPath?: string;
  messages: SessionHistoryItem[];
}

interface TaskEntry {
  createdAt: string;
  createdBy: string;
  content: string;
}

interface TaskRecord {
  taskId: string;
  boardId: string;
  createdAt: string;
  project: string;
  owner: string;
  assignedTo: string;
  title: string;
  description: string;
  status: string;
  statusReason?: string;
  blockers: string[];
  artifacts: TaskEntry[];
  worklog: TaskEntry[];
}

interface BoardSummary {
  boardId: string;
  title: string;
  createdAt: string;
  owner: string;
}

interface BoardRecord extends BoardSummary {
  tasks: TaskRecord[];
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

  app.post<{ Body: { name?: string; type?: "manager" | "individual"; reportsTo?: string | null; skills?: string[] | string; role?: string } }>(
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
        const createOptions: CreateAgentOptions = {
          type: request.body?.type,
          reportsTo: normalizeReportsTo(request.body?.reportsTo),
          skills
        };
        const role = normalizeRole(request.body?.role);
        if (role) {
          createOptions.role = role;
        }

        const created = await service.createAgent(name, createOptions);

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

  const handleSessionHistory = async (
    request: {
      query: {
        agentId?: string;
        sessionRef?: string;
        limit?: string;
      };
    },
    reply: FastifyReply
  ): Promise<unknown> => {
    return safeReply(reply, async () => {
      const agentId = request.query.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.query.sessionRef?.trim();
      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }

      const rawLimit = request.query.limit?.trim();
      const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
      const limit = typeof parsedLimit === "number" && Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;

      const history = await getUiSessionHistory(service, agentId, {
        sessionRef,
        limit
      });
      const sanitizedHistory: SessionHistoryResult = {
        ...history,
        messages: history.messages.map((item) => {
          if (item.type !== "message") {
            return item;
          }
          return {
            ...item,
            content: sanitizeConversationText(item.content)
          };
        })
      };

      return {
        agentId,
        sessionRef: sanitizedHistory.sessionKey,
        history: sanitizedHistory
      };
    });
  };

  app.get<{ Querystring: { agentId?: string; sessionRef?: string; limit?: string } }>("/api/sessions/history", handleSessionHistory);
  app.get<{ Querystring: { agentId?: string; sessionRef?: string; limit?: string } }>("/api/session/history", handleSessionHistory);

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

  app.get("/api/boards", async (_request, reply) => {
    return safeReply(reply, async () => {
      const summaries = await listUiBoards(service);
      const boards = await Promise.all(
        summaries.map(async (summary) => {
          return getUiBoard(service, summary.boardId);
        })
      );

      return {
        boards
      };
    });
  });

  app.get<{ Params: { boardId: string } }>("/api/boards/:boardId", async (request, reply) => {
    return safeReply(reply, async () => {
      const boardId = request.params.boardId?.trim();
      if (!boardId) {
        reply.code(400);
        return {
          error: "boardId is required"
        };
      }

      const board = await getUiBoard(service, boardId);
      return {
        board
      };
    });
  });

  const handleBoardCreate = async (
    request: {
      body?: {
        actorId?: string;
        title?: string;
      };
    },
    reply: FastifyReply
  ): Promise<unknown> => {
    return safeReply(reply, async () => {
      const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
      const title = request.body?.title?.trim();
      if (!title) {
        reply.code(400);
        return {
          error: "title is required"
        };
      }

      const board = await createUiBoard(service, actorId, { title });
      return {
        board,
        message: `Board \"${board.title}\" created.`
      };
    });
  };

  app.post<{ Body: { actorId?: string; title?: string } }>("/api/boards", handleBoardCreate);
  app.post<{ Body: { actorId?: string; title?: string } }>("/api/board/create", handleBoardCreate);

  app.post<{ Params: { boardId: string }; Body: { actorId?: string; title?: string } }>(
    "/api/boards/:boardId",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
        const boardId = request.params.boardId?.trim();
        const title = request.body?.title?.trim();
        if (!boardId) {
          reply.code(400);
          return {
            error: "boardId is required"
          };
        }
        if (!title) {
          reply.code(400);
          return {
            error: "title is required"
          };
        }

        const board = await updateUiBoard(service, actorId, boardId, { title });
        return {
          board,
          message: `Board \"${board.title}\" updated.`
        };
      });
    }
  );

  app.get<{ Params: { boardId: string } }>("/api/boards/:boardId/tasks", async (request, reply) => {
    return safeReply(reply, async () => {
      const boardId = request.params.boardId?.trim();
      if (!boardId) {
        reply.code(400);
        return {
          error: "boardId is required"
        };
      }

      const tasks = await listUiTasks(service, boardId);
      return {
        boardId,
        tasks
      };
    });
  });

  app.post<{
    Body: {
      actorId?: string;
      boardId?: string;
      title?: string;
      description?: string;
      project?: string;
      assignedTo?: string;
      status?: string;
    };
  }>("/api/tasks", async (request, reply) => {
    return safeReply(reply, async () => {
      const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
      const boardId = request.body?.boardId?.trim();
      const title = request.body?.title?.trim();
      const description = request.body?.description?.trim();
      const project = request.body?.project?.trim();
      const assignedTo = request.body?.assignedTo?.trim();
      const status = request.body?.status?.trim();

      if (!boardId) {
        reply.code(400);
        return {
          error: "boardId is required"
        };
      }
      if (!title) {
        reply.code(400);
        return {
          error: "title is required"
        };
      }
      if (!description) {
        reply.code(400);
        return {
          error: "description is required"
        };
      }

      const task = await createUiTask(service, actorId, boardId, {
        title,
        description,
        project,
        assignedTo,
        status
      });
      return {
        task,
        message: `Task \"${task.title}\" created.`
      };
    });
  });

  app.post<{ Params: { taskId: string }; Body: { actorId?: string; status?: string; reason?: string } }>(
    "/api/tasks/:taskId/status",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
        const taskId = request.params.taskId?.trim();
        const status = request.body?.status?.trim();
        const reason = request.body?.reason?.trim();
        if (!taskId) {
          reply.code(400);
          return {
            error: "taskId is required"
          };
        }
        if (!status) {
          reply.code(400);
          return {
            error: "status is required"
          };
        }

        const task = await updateUiTaskStatus(service, actorId, taskId, status, reason);
        return {
          task,
          message: `Task \"${task.taskId}\" updated.`
        };
      });
    }
  );

  app.post<{ Params: { taskId: string }; Body: { actorId?: string; content?: string } }>(
    "/api/tasks/:taskId/blocker",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
        const taskId = request.params.taskId?.trim();
        const content = request.body?.content?.trim();
        if (!taskId) {
          reply.code(400);
          return {
            error: "taskId is required"
          };
        }
        if (!content) {
          reply.code(400);
          return {
            error: "content is required"
          };
        }

        const task = await addUiTaskBlocker(service, actorId, taskId, content);
        return {
          task,
          message: `Blocker added to \"${task.taskId}\".`
        };
      });
    }
  );

  app.post<{ Params: { taskId: string }; Body: { actorId?: string; content?: string } }>(
    "/api/tasks/:taskId/artifact",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
        const taskId = request.params.taskId?.trim();
        const content = request.body?.content?.trim();
        if (!taskId) {
          reply.code(400);
          return {
            error: "taskId is required"
          };
        }
        if (!content) {
          reply.code(400);
          return {
            error: "content is required"
          };
        }

        const task = await addUiTaskArtifact(service, actorId, taskId, content);
        return {
          task,
          message: `Artifact added to \"${task.taskId}\".`
        };
      });
    }
  );

  app.post<{ Params: { taskId: string }; Body: { actorId?: string; content?: string } }>(
    "/api/tasks/:taskId/worklog",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
        const taskId = request.params.taskId?.trim();
        const content = request.body?.content?.trim();
        if (!taskId) {
          reply.code(400);
          return {
            error: "taskId is required"
          };
        }
        if (!content) {
          reply.code(400);
          return {
            error: "content is required"
          };
        }

        const task = await addUiTaskWorklog(service, actorId, taskId, content);
        return {
          task,
          message: `Worklog added to \"${task.taskId}\".`
        };
      });
    }
  );

  app.post<{ Body: { agentId?: string; folderName?: string; folderPath?: string } }>("/api/projects", async (request, reply) => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const project = await resolveProjectFolder(request.body?.folderName, request.body?.folderPath);
      const projectSessionRef = buildProjectSessionRef(project.name, project.path);
      await prepareProjectSession(service, agentId, {
        sessionRef: projectSessionRef,
        projectPath: project.path,
        forceNew: false
      });
      await renameUiSession(service, agentId, project.name, projectSessionRef);

      const workspaceSessionRef = buildWorkspaceSessionRef(project.name, project.path);
      const prepared = await prepareProjectSession(service, agentId, {
        sessionRef: workspaceSessionRef,
        projectPath: project.path,
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

  app.post<{ Body: { agentId?: string; projectPath?: string; workspaceName?: string } }>(
    "/api/workspaces/session",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
        const projectPath = request.body?.projectPath?.trim();
        if (!projectPath) {
          reply.code(400);
          return {
            error: "projectPath is required"
          };
        }

        const resolvedProjectPath = path.resolve(projectPath);
        const stats = await stat(resolvedProjectPath).catch(() => {
          return null;
        });
        if (!stats || !stats.isDirectory()) {
          throw new Error(`Workspace path is not a directory: ${resolvedProjectPath}`);
        }

        const workspaceName = request.body?.workspaceName?.trim() || path.basename(resolvedProjectPath);
        const sessionRef = buildWorkspaceSessionRef(workspaceName, resolvedProjectPath);
        const prepared = await prepareProjectSession(service, agentId, {
          sessionRef,
          projectPath: resolvedProjectPath,
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
    request: {
      body?: {
        agentId?: string;
        sessionRef?: string;
        projectPath?: string;
        message?: string;
        images?: UiImageInput[];
      };
    },
    reply: FastifyReply
  ): Promise<unknown> => {
    return safeReply(reply, async () => {
      const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
      const sessionRef = request.body?.sessionRef?.trim();
      const message = request.body?.message?.trim();
      const projectPath = request.body?.projectPath?.trim();
      const images = normalizeUiImages(request.body?.images);

      if (!sessionRef) {
        reply.code(400);
        return {
          error: "sessionRef is required"
        };
      }

      if (!message && images.length === 0) {
        reply.code(400);
        return {
          error: "message or image is required"
        };
      }

      const result = await runUiSessionMessage(service, agentId, {
        sessionRef,
        projectPath,
        message:
          message ||
          (images.length === 1
            ? "Please analyze the attached image."
            : "Please analyze the attached images."),
        images: images.length > 0 ? images : undefined
      });

      const output = sanitizeConversationText(result.stdout.trim() || result.stderr.trim());

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

  app.post<{
    Body: { agentId?: string; sessionRef?: string; projectPath?: string; message?: string; images?: UiImageInput[] };
  }>(
    "/api/sessions/message",
    handleSessionMessage
  );
  app.post<{
    Body: { agentId?: string; sessionRef?: string; projectPath?: string; message?: string; images?: UiImageInput[] };
  }>(
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

function normalizeRole(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function sanitizeConversationText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutAnsi = stripAnsiCodes(trimmed)
    .replace(/\[(?:\d{1,3};)*\d{1,3}m/g, "")
    .replace(/(?:^|\s)(?:\d{1,3};)*\d{1,3}m(?=\s|$)/g, " ")
    .replace(/\r\n?/g, "\n");

  const withoutPrefix = withoutAnsi
    .replace(/^\s*\[agents\/[^\]\n]+\]\s*/iu, "")
    .replace(/^\s*inherited\s+[^\n]*?\s+from\s+main\s+agent\s*/iu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return withoutPrefix || trimmed;
}

function stripAnsiCodes(value: string): string {
  return value.replace(
    /[\u001B\u009B][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-ntqry=><]/g,
    ""
  );
}

async function prepareProjectSession(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    projectPath: string;
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
        request: { sessionRef?: string; forceNew?: boolean; projectPath?: string; userMessage: string }
      ) => Promise<LegacyPreparedSessionRun>;
      renameSession?: (paths: unknown, legacyAgentId: string, title: string, sessionRef?: string) => Promise<SessionSummary>;
      removeSession?: (paths: unknown, legacyAgentId: string, sessionRef?: string) => Promise<SessionRemoveResult>;
    };
  };

  if (typeof legacy.getPaths === "function" && typeof legacy.sessionService?.prepareRunSession === "function") {
    const prepared = await legacy.sessionService.prepareRunSession(legacy.getPaths(), agentId, {
      sessionRef: options.sessionRef,
      forceNew: options.forceNew,
      projectPath: options.projectPath,
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

async function getUiSessionHistory(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    limit?: number;
  }
): Promise<SessionHistoryResult> {
  if (typeof service.getSessionHistory === "function") {
    return service.getSessionHistory(agentId, {
      sessionRef: options.sessionRef,
      limit: options.limit
    });
  }

  const legacy = service as OpenClawUiService & {
    sessionService?: {
      getSessionHistory?: (
        paths: unknown,
        legacyAgentId: string,
        request: {
          sessionRef?: string;
          limit?: number;
          includeCompaction?: boolean;
        }
      ) => Promise<SessionHistoryResult>;
    };
  };
  if (typeof legacy.getPaths === "function" && typeof legacy.sessionService?.getSessionHistory === "function") {
    return legacy.sessionService.getSessionHistory(legacy.getPaths(), agentId, {
      sessionRef: options.sessionRef,
      limit: options.limit
    });
  }

  throw new Error("Session history is unavailable on this runtime.");
}

async function runUiSessionMessage(
  service: OpenClawUiService,
  agentId: string,
  options: {
    sessionRef: string;
    projectPath?: string;
    message: string;
    images?: UiImageInput[];
  }
): Promise<AgentRunResult> {
  if (typeof service.runAgent === "function") {
    return service.runAgent(agentId, {
      message: options.message,
      sessionRef: options.sessionRef,
      cwd: options.projectPath,
      images: options.images
    });
  }

  throw new Error("Session messaging is unavailable on this runtime.");
}

async function listUiBoards(service: OpenClawUiService): Promise<BoardSummary[]> {
  if (typeof service.listBoards === "function") {
    return service.listBoards();
  }

  throw new Error("Board listing is unavailable on this runtime.");
}

async function getUiBoard(service: OpenClawUiService, boardId: string): Promise<BoardRecord> {
  if (typeof service.getBoard === "function") {
    return service.getBoard(boardId);
  }

  throw new Error("Board details are unavailable on this runtime.");
}

async function createUiBoard(
  service: OpenClawUiService,
  actorId: string,
  options: {
    title: string;
  }
): Promise<BoardSummary> {
  if (typeof service.createBoard === "function") {
    return service.createBoard(actorId, options);
  }

  throw new Error("Board creation is unavailable on this runtime.");
}

async function updateUiBoard(
  service: OpenClawUiService,
  actorId: string,
  boardId: string,
  options: {
    title?: string;
  }
): Promise<BoardSummary> {
  if (typeof service.updateBoard === "function") {
    return service.updateBoard(actorId, boardId, options);
  }

  throw new Error("Board updates are unavailable on this runtime.");
}

async function createUiTask(
  service: OpenClawUiService,
  actorId: string,
  boardId: string,
  options: {
    title: string;
    description: string;
    project?: string;
    assignedTo?: string;
    status?: string;
  }
): Promise<TaskRecord> {
  if (typeof service.createTask === "function") {
    return service.createTask(actorId, boardId, options);
  }

  throw new Error("Task creation is unavailable on this runtime.");
}

async function listUiTasks(service: OpenClawUiService, boardId: string): Promise<TaskRecord[]> {
  if (typeof service.listTasks === "function") {
    return service.listTasks(boardId);
  }

  throw new Error("Task listing is unavailable on this runtime.");
}

async function updateUiTaskStatus(
  service: OpenClawUiService,
  actorId: string,
  taskId: string,
  status: string,
  reason?: string
): Promise<TaskRecord> {
  if (typeof service.updateTaskStatus === "function") {
    return service.updateTaskStatus(actorId, taskId, status, reason);
  }

  throw new Error("Task status updates are unavailable on this runtime.");
}

async function addUiTaskBlocker(service: OpenClawUiService, actorId: string, taskId: string, content: string): Promise<TaskRecord> {
  if (typeof service.addTaskBlocker === "function") {
    return service.addTaskBlocker(actorId, taskId, content);
  }

  throw new Error("Task blocker updates are unavailable on this runtime.");
}

async function addUiTaskArtifact(service: OpenClawUiService, actorId: string, taskId: string, content: string): Promise<TaskRecord> {
  if (typeof service.addTaskArtifact === "function") {
    return service.addTaskArtifact(actorId, taskId, content);
  }

  throw new Error("Task artifact updates are unavailable on this runtime.");
}

async function addUiTaskWorklog(service: OpenClawUiService, actorId: string, taskId: string, content: string): Promise<TaskRecord> {
  if (typeof service.addTaskWorklog === "function") {
    return service.addTaskWorklog(actorId, taskId, content);
  }

  throw new Error("Task worklog updates are unavailable on this runtime.");
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

function normalizeUiImages(images: UiImageInput[] | undefined): UiImageInput[] {
  if (!images || images.length === 0) {
    return [];
  }

  return images.filter((image) => {
    if (!image || typeof image !== "object") {
      return false;
    }

    const dataUrl = image.dataUrl?.trim();
    const mediaType = image.mediaType?.trim();
    return Boolean(dataUrl && dataUrl.startsWith("data:") && mediaType?.toLowerCase().startsWith("image/"));
  });
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
          role?: string;
          organization?: {
            reportsTo?: string | null;
            type?: string;
          };
        };

        const organization = parsed.organization;
        const reportsTo = normalizeReportsToValue(organization?.reportsTo, fallbackReportsTo, agentIds);
        const type = normalizeTypeValue(organization?.type, fallbackType);
        const role = normalizeRoleValue(parsed.role);

        return {
          ...agent,
          reportsTo,
          type,
          role
        };
      } catch {
        return {
          ...agent,
          reportsTo: fallbackReportsTo,
          type: fallbackType,
          role: undefined
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

function normalizeRoleValue(rawRole: string | undefined): string | undefined {
  const normalized = rawRole?.trim();
  if (normalized) {
    const genericRole = normalized.toLowerCase();
    if (genericRole === "manager" || genericRole === "individual contributor" || genericRole === "team member") {
      return undefined;
    }
    return normalized;
  }
  return undefined;
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
