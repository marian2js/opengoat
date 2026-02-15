import { stat } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  DEFAULT_AGENT_ID,
  DEFAULT_TASK_CHECK_FREQUENCY_MINUTES,
  LOG_STREAM_HEARTBEAT_MS,
  MAX_MAX_INACTIVITY_MINUTES,
  MIN_MAX_INACTIVITY_MINUTES,
} from "./constants.js";
import {
  normalizePasswordInput,
  normalizeUiAuthenticationPasswordHash,
  normalizeUiAuthenticationUsername,
} from "./auth.js";
import {
  extractRuntimeActivityFromLogLines,
  fetchOpenClawGatewayLogTail,
} from "./runtime-logs.js";
import {
  isCeoBootstrapPending,
  parseBooleanSetting,
  parseInactiveAgentNotificationTarget,
  parseMaxInactivityMinutes,
  parseNotifyManagersOfInactiveAgents,
  parseTaskCronEnabled,
  parseUiLogStreamFollow,
  parseUiLogStreamLimit,
  toPublicUiServerSettings,
} from "./settings.js";
import {
  addUiTaskArtifact,
  addUiTaskBlocker,
  addUiTaskWorklog,
  buildProjectSessionRef,
  buildWorkspaceSessionRef,
  createUiTask,
  deleteUiTasks,
  getUiSessionHistory,
  listUiTasks,
  normalizeReportsTo,
  normalizeRole,
  normalizeSkills,
  normalizeUiImages,
  pickProjectFolderFromSystem,
  prepareProjectSession,
  removeUiSession,
  renameUiSession,
  resolveAbsolutePath,
  resolveDefaultWorkspaceSessionTitle,
  resolveOrganizationAgents,
  resolveProjectFolder,
  resolveSessionProjectPathForRequest,
  runUiSessionMessage,
  updateUiTaskStatus,
} from "./session.js";
import {
  formatRunStatusMessage,
  mapRunStageToProgressPhase,
  sanitizeConversationText,
  sanitizeRuntimeProgressChunk,
  truncateProgressLine,
} from "./text.js";
import {
  deleteWikiPageByPath,
  readWikiPageByPath,
  updateWikiPageByPath,
} from "./wiki.js";
import type {
  CreateAgentOptions,
  DeleteAgentOptions,
  InactiveAgentNotificationTarget,
  OpenClawUiService,
  RegisterApiRoutesDeps,
  UiServerAuthenticationSettings,
  UiServerSettings,
  SessionHistoryResult,
  SessionMessageProgressPhase,
  SessionMessageStreamEvent,
  UiImageInput,
  UiLogStreamEvent,
} from "./types.js";

export function registerApiRoutes(
  app: FastifyInstance,
  service: OpenClawUiService,
  mode: "development" | "production",
  deps: RegisterApiRoutesDeps
): void {
  app.get("/api/auth/status", async (request, reply) => {
    return safeReply(reply, async () => {
      return {
        authentication: deps.auth.getStatusForRequest(request),
      };
    });
  });

  app.post<{
    Body: {
      username?: string;
      password?: string;
    };
  }>("/api/auth/login", async (request, reply) => {
    return safeReply(reply, async () => {
      if (!deps.auth.isAuthenticationRequired()) {
        return {
          authentication: {
            enabled: false,
            authenticated: true,
          },
          message: "UI authentication is disabled.",
        };
      }

      const blockedAttempt = deps.auth.checkAttemptStatus(request);
      if (blockedAttempt.blocked) {
        const retryAfterSeconds = blockedAttempt.retryAfterSeconds ?? 60;
        reply.code(429);
        reply.header("Retry-After", String(retryAfterSeconds));
        return {
          error: "Too many failed sign-in attempts. Try again later.",
          code: "AUTH_RATE_LIMITED",
          retryAfterSeconds,
        };
      }

      const username = request.body?.username ?? "";
      const password = request.body?.password ?? "";
      const validCredentials = await deps.auth.verifyCredentials(
        username,
        password,
      );
      if (!validCredentials) {
        const lockState = deps.auth.registerFailedAttempt(request);
        if (lockState.blocked) {
          const retryAfterSeconds = lockState.retryAfterSeconds ?? 60;
          reply.code(429);
          reply.header("Retry-After", String(retryAfterSeconds));
          return {
            error: "Too many failed sign-in attempts. Try again later.",
            code: "AUTH_RATE_LIMITED",
            retryAfterSeconds,
          };
        }
        reply.code(401);
        return {
          error: "Invalid username or password.",
          code: "AUTH_INVALID_CREDENTIALS",
        };
      }

      const issueCookieResult = deps.auth.issueSessionCookie(
        reply,
        request,
        username,
      );
      if (!issueCookieResult.ok) {
        reply.code(400);
        return {
          error:
            issueCookieResult.error ??
            "Unable to establish an authentication session.",
          code: "AUTH_SESSION_ISSUE_FAILED",
        };
      }

      deps.auth.clearFailedAttempts(request);
      return {
        authentication: {
          enabled: true,
          authenticated: true,
        },
        message: "Signed in.",
      };
    });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    return safeReply(reply, async () => {
      deps.auth.clearSessionCookie(reply, request);
      deps.auth.clearFailedAttempts(request);
      const status = deps.auth.getStatusForRequest(request);
      return {
        authentication: {
          enabled: status.enabled,
          authenticated: false,
        },
        message: "Signed out.",
      };
    });
  });

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

  app.get<{ Querystring: { path?: string } }>(
    "/api/wiki/page",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const resolved = await readWikiPageByPath(
          service.getHomeDir(),
          request.query?.path,
        );
        if (!resolved.page) {
          reply.code(404);
          return {
            error: resolved.pages.length
              ? `Wiki page not found for path "${resolved.requestedPath || "/"}".`
              : "No wiki markdown files were found.",
            wikiRoot: resolved.wikiRoot,
            pages: resolved.pages,
            requestedPath: resolved.requestedPath,
          };
        }

        return resolved;
      });
    },
  );

  app.post<{ Body: { path?: string; content?: string } }>(
    "/api/wiki/page",
    async (request, reply) => {
      return safeReply(reply, async () => {
        if (typeof request.body?.content !== "string") {
          reply.code(400);
          return {
            error: "content is required",
          };
        }

        const resolved = await updateWikiPageByPath(
          service.getHomeDir(),
          request.body?.path,
          request.body.content,
        );
        if (!resolved.page) {
          reply.code(404);
          return {
            error: resolved.pages.length
              ? `Wiki page not found for path "${resolved.requestedPath || "/"}".`
              : "No wiki markdown files were found.",
            wikiRoot: resolved.wikiRoot,
            pages: resolved.pages,
            requestedPath: resolved.requestedPath,
          };
        }

        return {
          ...resolved,
          message: `Wiki page "${resolved.page.path || "/"}" updated.`,
        };
      });
    },
  );

  app.delete<{ Querystring: { path?: string } }>(
    "/api/wiki/page",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const resolved = await deleteWikiPageByPath(
          service.getHomeDir(),
          request.query?.path,
        );
        if (!resolved.deletedPath) {
          reply.code(404);
          return {
            error: resolved.pages.length
              ? `Wiki page not found for path "${resolved.requestedPath || "/"}".`
              : "No wiki markdown files were found.",
            wikiRoot: resolved.wikiRoot,
            pages: resolved.pages,
            requestedPath: resolved.requestedPath,
          };
        }

        return {
          ...resolved,
          message: `Wiki page "${resolved.deletedPath || "/"}" deleted.`,
        };
      });
    },
  );

  app.get("/api/settings", async (_request, reply) => {
    return safeReply(reply, async () => {
      const ceoBootstrapPending = isCeoBootstrapPending(service.getHomeDir());
      return {
        settings: toPublicUiServerSettings(
          deps.getSettings(),
          deps.auth.getSettingsResponse(),
          {
            ceoBootstrapPending,
          },
        ),
      };
    });
  });

  app.post<{
    Body: {
      taskCronEnabled?: boolean;
      notifyManagersOfInactiveAgents?: boolean;
      maxInactivityMinutes?: number;
      inactiveAgentNotificationTarget?: InactiveAgentNotificationTarget;
      authentication?: {
        enabled?: boolean;
        username?: string;
        password?: string;
        currentPassword?: string;
      };
    };
  }>("/api/settings", async (request, reply) => {
    return safeReply(reply, async () => {
      const currentSettings = deps.getSettings();
      const hasTaskCronEnabledSetting = Object.prototype.hasOwnProperty.call(
        request.body ?? {},
        "taskCronEnabled",
      );
      const hasNotifyManagersSetting = Object.prototype.hasOwnProperty.call(
        request.body ?? {},
        "notifyManagersOfInactiveAgents",
      );
      const hasMaxInactivitySetting = Object.prototype.hasOwnProperty.call(
        request.body ?? {},
        "maxInactivityMinutes",
      );
      const hasNotificationTargetSetting =
        Object.prototype.hasOwnProperty.call(
          request.body ?? {},
          "inactiveAgentNotificationTarget",
        );
      const hasAuthenticationSetting = Object.prototype.hasOwnProperty.call(
        request.body ?? {},
        "authentication",
      );

      const parsedTaskCronEnabled = hasTaskCronEnabledSetting
        ? parseTaskCronEnabled(request.body?.taskCronEnabled)
        : currentSettings.taskCronEnabled;
      if (parsedTaskCronEnabled === undefined) {
        reply.code(400);
        return {
          error: "taskCronEnabled must be true or false",
        };
      }

      const parsedNotifyManagers = hasNotifyManagersSetting
        ? parseNotifyManagersOfInactiveAgents(
            request.body?.notifyManagersOfInactiveAgents,
          )
        : currentSettings.notifyManagersOfInactiveAgents;
      if (parsedNotifyManagers === undefined) {
        reply.code(400);
        return {
          error: "notifyManagersOfInactiveAgents must be true or false",
        };
      }

      const parsedMaxInactivityMinutes = hasMaxInactivitySetting
        ? parseMaxInactivityMinutes(request.body?.maxInactivityMinutes)
        : currentSettings.maxInactivityMinutes;
      if (!parsedMaxInactivityMinutes) {
        reply.code(400);
        return {
          error: `maxInactivityMinutes must be an integer between ${MIN_MAX_INACTIVITY_MINUTES} and ${MAX_MAX_INACTIVITY_MINUTES}`,
        };
      }
      const parsedNotificationTarget = hasNotificationTargetSetting
        ? parseInactiveAgentNotificationTarget(
            request.body?.inactiveAgentNotificationTarget,
          )
        : currentSettings.inactiveAgentNotificationTarget;
      if (!parsedNotificationTarget) {
        reply.code(400);
        return {
          error:
            "inactiveAgentNotificationTarget must be either all-managers or ceo-only",
        };
      }

      let nextAuthentication: UiServerAuthenticationSettings =
        currentSettings.authentication;
      if (hasAuthenticationSetting) {
        const authenticationBody = request.body?.authentication ?? {};
        const hasEnabled = Object.prototype.hasOwnProperty.call(
          authenticationBody,
          "enabled",
        );
        const hasUsername = Object.prototype.hasOwnProperty.call(
          authenticationBody,
          "username",
        );
        const hasPassword = Object.prototype.hasOwnProperty.call(
          authenticationBody,
          "password",
        );
        const hasCurrentPassword = Object.prototype.hasOwnProperty.call(
          authenticationBody,
          "currentPassword",
        );

        const currentAuthentication = currentSettings.authentication;
        const parsedEnabled = hasEnabled
          ? parseBooleanSetting(authenticationBody.enabled)
          : currentAuthentication.enabled;
        if (parsedEnabled === undefined) {
          reply.code(400);
          return {
            error: "authentication.enabled must be true or false",
          };
        }

        const providedUsername = hasUsername
          ? normalizeUiAuthenticationUsername(authenticationBody.username)
          : normalizeUiAuthenticationUsername(currentAuthentication.username);
        if (hasUsername && !providedUsername) {
          reply.code(400);
          return {
            error:
              "authentication.username must use 3-64 lowercase characters, numbers, dots, dashes, or underscores.",
          };
        }

        const rawNewPassword = hasPassword
          ? normalizePasswordInput(authenticationBody.password ?? "")
          : "";
        const hasNewPassword = rawNewPassword.length > 0;
        if (hasPassword && !hasNewPassword) {
          reply.code(400);
          return {
            error: "authentication.password cannot be empty when provided.",
          };
        }
        if (hasNewPassword) {
          const passwordValidationError =
            deps.auth.validatePasswordStrength(rawNewPassword);
          if (passwordValidationError) {
            reply.code(400);
            return {
              error: passwordValidationError,
            };
          }
        }

        const currentEnabledSettings = deps.auth.getSettingsResponse().enabled;
        const changingEnabledState = parsedEnabled !== currentAuthentication.enabled;
        const changingUsername =
          hasUsername &&
          providedUsername !==
            normalizeUiAuthenticationUsername(currentAuthentication.username);
        const changingPassword = hasNewPassword;
        const requiresCurrentPasswordVerification =
          currentEnabledSettings &&
          (changingEnabledState || changingUsername || changingPassword);
        if (requiresCurrentPasswordVerification) {
          const currentPassword = hasCurrentPassword
            ? normalizePasswordInput(authenticationBody.currentPassword ?? "")
            : "";
          if (!currentPassword) {
            reply.code(400);
            return {
              error:
                "authentication.currentPassword is required to modify UI authentication settings.",
            };
          }
          const currentPasswordValid = await deps.auth.verifyCurrentPassword(
            currentPassword,
          );
          if (!currentPasswordValid) {
            reply.code(401);
            return {
              error: "Current password is incorrect.",
              code: "AUTH_INVALID_CURRENT_PASSWORD",
            };
          }
        }

        const nextUsername =
          providedUsername ??
          normalizeUiAuthenticationUsername(currentAuthentication.username);
        const nextPasswordHash = hasNewPassword
          ? await deps.auth.hashPassword(rawNewPassword)
          : normalizeUiAuthenticationPasswordHash(
              currentAuthentication.passwordHash,
            );
        if (parsedEnabled && (!nextUsername || !nextPasswordHash)) {
          reply.code(400);
          return {
            error:
              "authentication.username and authentication.password are required when enabling UI authentication.",
          };
        }

        nextAuthentication = {
          enabled: parsedEnabled,
          username: nextUsername,
          passwordHash: nextPasswordHash,
        };
      }

      const nextSettings: UiServerSettings = {
        taskCronEnabled: parsedTaskCronEnabled,
        notifyManagersOfInactiveAgents: parsedNotifyManagers,
        maxInactivityMinutes: parsedMaxInactivityMinutes,
        inactiveAgentNotificationTarget: parsedNotificationTarget,
        authentication: nextAuthentication,
      };
      await deps.updateSettings(nextSettings);

      const nextAuthResponse = deps.auth.getSettingsResponse();
      if (nextAuthResponse.enabled) {
        const currentAuthStatus = deps.auth.getStatusForRequest(request);
        let issuedSession = false;
        if (currentAuthStatus.authenticated) {
          const issued = deps.auth.issueSessionCookie(
            reply,
            request,
            nextAuthResponse.username,
          );
          if (!issued.ok) {
            reply.code(400);
            return {
              error:
                issued.error ??
                "Unable to establish an authentication session.",
              code: "AUTH_SESSION_ISSUE_FAILED",
            };
          }
          issuedSession = true;
        } else if (
          hasAuthenticationSetting &&
          normalizeUiAuthenticationUsername(
            request.body?.authentication?.username,
          ) === nextAuthResponse.username &&
          typeof request.body?.authentication?.password === "string" &&
          request.body.authentication.password.length > 0
        ) {
          const issued = deps.auth.issueSessionCookie(
            reply,
            request,
            nextAuthResponse.username,
          );
          if (!issued.ok) {
            reply.code(400);
            return {
              error:
                issued.error ??
                "Unable to establish an authentication session.",
              code: "AUTH_SESSION_ISSUE_FAILED",
            };
          }
          issuedSession = true;
        }
        if (!issuedSession) {
          reply.code(400);
          return {
            error:
              "Sign-in credentials are required when enabling UI authentication.",
            code: "AUTH_LOGIN_REQUIRED",
          };
        }
      }

      deps.logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `UI settings updated: taskCronEnabled=${nextSettings.taskCronEnabled} notifyManagersOfInactiveAgents=${nextSettings.notifyManagersOfInactiveAgents} maxInactivityMinutes=${nextSettings.maxInactivityMinutes} inactiveAgentNotificationTarget=${nextSettings.inactiveAgentNotificationTarget} authEnabled=${nextSettings.authentication.enabled}`,
      });
      const ceoBootstrapPending = isCeoBootstrapPending(service.getHomeDir());
      const taskAutomationMessage = !nextSettings.taskCronEnabled
        ? "disabled"
        : ceoBootstrapPending
          ? "enabled, waiting for the first CEO message before checks start"
          : "enabled";
      return {
        settings: toPublicUiServerSettings(nextSettings, nextAuthResponse, {
          ceoBootstrapPending,
        }),
        message: `Task automation checks ${taskAutomationMessage} (runs every ${DEFAULT_TASK_CHECK_FREQUENCY_MINUTES} minute(s)). Inactive-agent manager notifications ${
          nextSettings.notifyManagersOfInactiveAgents
            ? "enabled"
            : "disabled"
        }; threshold ${nextSettings.maxInactivityMinutes} minute(s); audience ${nextSettings.inactiveAgentNotificationTarget}.`,
      };
    });
  });

  app.get("/api/version", async (_request, reply) => {
    return safeReply(reply, async () => {
      return {
        version: await deps.getVersionInfo()
      };
    });
  });

  app.get<{ Querystring: { limit?: string; follow?: string } }>("/api/logs/stream", async (request, reply) => {
    const limit = parseUiLogStreamLimit(request.query?.limit);
    const follow = parseUiLogStreamFollow(request.query?.follow);
    const raw = reply.raw;

    reply.hijack();
    raw.statusCode = 200;
    raw.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    raw.setHeader("Cache-Control", "no-cache, no-transform");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("X-Accel-Buffering", "no");
    raw.flushHeaders?.();

    const writeEvent = (event: UiLogStreamEvent): void => {
      if (raw.destroyed || raw.writableEnded) {
        return;
      }
      raw.write(`${JSON.stringify(event)}\n`);
    };

    writeEvent({
      type: "snapshot",
      entries: deps.logs.listRecent(limit),
    });

    if (!follow) {
      if (!raw.destroyed && !raw.writableEnded) {
        raw.end();
      }
      return;
    }

    const unsubscribe = deps.logs.subscribe((entry) => {
      writeEvent({
        type: "log",
        entry,
      });
    });
    const heartbeat = setInterval(() => {
      writeEvent({
        type: "heartbeat",
        timestamp: new Date().toISOString(),
      });
    }, LOG_STREAM_HEARTBEAT_MS);
    heartbeat.unref?.();

    const cleanup = (): void => {
      unsubscribe();
      clearInterval(heartbeat);
      if (!raw.destroyed && !raw.writableEnded) {
        raw.end();
      }
    };

    raw.on("close", cleanup);
    raw.on("error", cleanup);
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

  app.get<{ Querystring: { assignee?: string; limit?: string } }>(
    "/api/tasks",
    async (request, reply) => {
      return safeReply(reply, async () => {
        const assignee = request.query.assignee?.trim();
        const rawLimit = request.query.limit?.trim();
        const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
        const limit = Number.isFinite(parsedLimit) && (parsedLimit ?? 0) > 0 ? parsedLimit : undefined;
        const tasks = await listUiTasks(service, {
          assignee,
          limit
        });
        return {
          tasks
        };
      });
    }
  );

  app.post<{
    Body: {
      actorId?: string;
      title?: string;
      description?: string;
      project?: string;
      assignedTo?: string;
      status?: string;
    };
  }>("/api/tasks", async (request, reply) => {
    return safeReply(reply, async () => {
      const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
      const title = request.body?.title?.trim();
      const description = request.body?.description?.trim();
      const project = request.body?.project?.trim();
      const assignedTo = request.body?.assignedTo?.trim();
      const status = request.body?.status?.trim();

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

      const task = await createUiTask(service, actorId, {
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

  const deleteTasksHandler = async (
    request: {
      body?: {
        actorId?: string;
        taskIds?: unknown;
      };
    },
    reply: FastifyReply
  ): Promise<
    { error: string } | { deletedTaskIds: string[]; deletedCount: number; message: string }
  > => {
    return safeReply(reply, async () => {
      const actorId = request.body?.actorId?.trim() || DEFAULT_AGENT_ID;
      const rawTaskIds = Array.isArray(request.body?.taskIds)
        ? request.body.taskIds
        : [];
      const taskIds = [...new Set(rawTaskIds)]
        .filter((taskId): taskId is string => typeof taskId === "string")
        .map((taskId) => taskId.trim())
        .filter((taskId) => taskId.length > 0);

      if (taskIds.length === 0) {
        reply.code(400);
        return {
          error: "taskIds must be a non-empty array"
        };
      }

      const result = await deleteUiTasks(service, actorId, taskIds);
      return {
        ...result,
        message: `Deleted ${result.deletedCount} task${result.deletedCount === 1 ? "" : "s"}.`
      };
    });
  };

  app.delete<{
    Body: {
      actorId?: string;
      taskIds?: unknown;
    };
  }>("/api/tasks", deleteTasksHandler);

  app.post<{
    Body: {
      actorId?: string;
      taskIds?: unknown;
    };
  }>("/api/tasks/delete", deleteTasksHandler);

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

        const resolvedProjectPath = resolveAbsolutePath(projectPath);
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

      const projectPath = await resolveSessionProjectPathForRequest(
        service,
        agentId,
        sessionRef,
        request.body?.projectPath
      );

      deps.logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `Session message request queued for @${agentId} (session=${sessionRef}).`,
      });

      const result = await runUiSessionMessage(service, agentId, {
        sessionRef,
        projectPath,
        message:
          message ||
          (images.length === 1
            ? "Please analyze the attached image."
            : "Please analyze the attached images."),
        images: images.length > 0 ? images : undefined,
        hooks: {
          onEvent: (event) => {
            deps.logs.append({
              timestamp: event.timestamp || new Date().toISOString(),
              level:
                event.stage === "provider_invocation_completed" &&
                typeof event.code === "number" &&
                event.code !== 0
                  ? "warn"
                  : "info",
              source: "opengoat",
              message: formatRunStatusMessage(event),
            });
          },
        },
      });

      const output = sanitizeConversationText(result.stdout.trim() || result.stderr.trim());
      deps.logs.append({
        timestamp: new Date().toISOString(),
        level: result.code === 0 ? "info" : "warn",
        source: "opengoat",
        message:
          result.code === 0
            ? `Session message completed for @${agentId} (session=${sessionRef}).`
            : `Session message completed with code ${result.code} for @${agentId} (session=${sessionRef}).`,
      });

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

  const handleSessionMessageStream = async (
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
  ): Promise<void> => {
    const agentId = request.body?.agentId?.trim() || DEFAULT_AGENT_ID;
    const sessionRef = request.body?.sessionRef?.trim();
    const message = request.body?.message?.trim();
    const images = normalizeUiImages(request.body?.images);

    if (!sessionRef) {
      reply.code(400).send({ error: "sessionRef is required" });
      return;
    }

    if (!message && images.length === 0) {
      reply.code(400).send({ error: "message or image is required" });
      return;
    }

    let projectPath: string | undefined;
    try {
      projectPath = await resolveSessionProjectPathForRequest(
        service,
        agentId,
        sessionRef,
        request.body?.projectPath
      );
    } catch (error) {
      const streamError =
        error instanceof Error ? error.message : "Unexpected server error";
      reply.code(500).send({ error: streamError });
      return;
    }

    const raw = reply.raw;
    const runtimeAbortController = new AbortController();
    const abortRuntimeRun = (): void => {
      if (!runtimeAbortController.signal.aborted) {
        runtimeAbortController.abort();
      }
    };
    raw.on("close", abortRuntimeRun);
    reply.hijack();
    raw.statusCode = 200;
    raw.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    raw.setHeader("Cache-Control", "no-cache, no-transform");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("X-Accel-Buffering", "no");
    raw.flushHeaders?.();

    const writeEvent = (event: SessionMessageStreamEvent): void => {
      if (raw.destroyed || raw.writableEnded) {
        return;
      }
      raw.write(`${JSON.stringify(event)}\n`);
    };

    const startedAtMs = Date.now();
    let runtimeRunId: string | undefined;
    let fallbackRuntimeRunId: string | undefined;
    let logCursor: number | undefined;
    let logPoller: NodeJS.Timeout | undefined;
    let telemetryWarningEmitted = false;
    let pollRuntimeLogs: (() => Promise<void>) | undefined;
    const seenRuntimeLogMessages = new Set<string>();

    const writeProgress = (
      phase: SessionMessageProgressPhase,
      progressMessage: string,
    ): void => {
      writeEvent({
        type: "progress",
        phase,
        timestamp: new Date().toISOString(),
        message: progressMessage,
      });
    };

    deps.logs.append({
      timestamp: new Date().toISOString(),
      level: "info",
      source: "opengoat",
      message: `Streaming session message request queued for @${agentId} (session=${sessionRef}).`,
    });

    const startRuntimeLogPolling = async (runId: string): Promise<void> => {
      runtimeRunId = runId;
      if (typeof service.getOpenClawGatewayConfig !== "function") {
        return;
      }

      let inFlight = false;
      const poll = async (): Promise<void> => {
        const primaryRunId = runtimeRunId;
        if (inFlight || !primaryRunId) {
          return;
        }
        inFlight = true;
        try {
          const tailed = await fetchOpenClawGatewayLogTail(service, {
            cursor: logCursor,
            limit: 200,
            maxBytes: 250000,
          });
          logCursor = tailed.cursor;
          const extracted = extractRuntimeActivityFromLogLines(tailed.lines, {
            primaryRunId,
            fallbackRunId: fallbackRuntimeRunId,
            startedAtMs,
          });
          if (!fallbackRuntimeRunId && extracted.nextFallbackRunId) {
            fallbackRuntimeRunId = extracted.nextFallbackRunId;
          }
          for (const activity of extracted.activities) {
            const dedupeKey = `${activity.level}:${activity.message}`;
            if (seenRuntimeLogMessages.has(dedupeKey)) {
              continue;
            }
            seenRuntimeLogMessages.add(dedupeKey);
            if (seenRuntimeLogMessages.size > 600) {
              const first = seenRuntimeLogMessages.values().next().value;
              if (first) {
                seenRuntimeLogMessages.delete(first);
              }
            }
            writeProgress(activity.level, activity.message);
          }
        } catch (error) {
          if (!telemetryWarningEmitted) {
            telemetryWarningEmitted = true;
            const details =
              error instanceof Error ? error.message.toLowerCase() : "";
            writeProgress(
              "stderr",
              details.includes("enoent")
                ? "Live activity is unavailable in this environment."
                : "Live activity stream is temporarily unavailable.",
            );
            deps.logs.append({
              timestamp: new Date().toISOString(),
              level: "warn",
              source: "opengoat",
              message: details.includes("enoent")
                ? "Live OpenClaw activity is unavailable in this environment."
                : "Live OpenClaw activity stream is temporarily unavailable.",
            });
          }
        } finally {
          inFlight = false;
        }
      };

      pollRuntimeLogs = poll;
      void poll();
      logPoller = setInterval(() => {
        void poll();
      }, 900);
    };

    const emitRuntimeChunk = (phase: "stdout" | "stderr", chunk: string): void => {
      const cleaned = sanitizeRuntimeProgressChunk(chunk);
      if (!cleaned) {
        return;
      }

      const lines = cleaned
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        return;
      }

      const limit = 6;
      for (const line of lines.slice(0, limit)) {
        writeProgress(phase, truncateProgressLine(line));
      }
      if (lines.length > limit) {
        writeProgress(phase, `... ${lines.length - limit} more line(s)`);
      }
    };

    try {
      const result = await runUiSessionMessage(service, agentId, {
        sessionRef,
        projectPath,
        message:
          message ||
          (images.length === 1
            ? "Please analyze the attached image."
            : "Please analyze the attached images."),
        images: images.length > 0 ? images : undefined,
        abortSignal: runtimeAbortController.signal,
        hooks: {
          onEvent: (event) => {
            deps.logs.append({
              timestamp: event.timestamp || new Date().toISOString(),
              level:
                event.stage === "provider_invocation_completed" &&
                typeof event.code === "number" &&
                event.code !== 0
                  ? "warn"
                  : "info",
              source: "opengoat",
              message: formatRunStatusMessage(event),
            });
            const phase = mapRunStageToProgressPhase(event.stage);
            writeProgress(phase, formatRunStatusMessage(event));
            if (
              (event.stage === "run_started" ||
                event.stage === "provider_invocation_started") &&
              event.runId &&
              !logPoller
            ) {
              void startRuntimeLogPolling(event.runId);
            }
          },
        },
        onStderr: (chunk) => {
          emitRuntimeChunk("stderr", chunk);
        },
      });

      const output = sanitizeConversationText(
        result.stdout.trim() || result.stderr.trim(),
      );
      writeEvent({
        type: "result",
        agentId,
        sessionRef,
        output,
        result: {
          code: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
        },
        message:
          result.code === 0
            ? "Message sent."
            : "Message completed with non-zero exit code.",
      });
      deps.logs.append({
        timestamp: new Date().toISOString(),
        level: result.code === 0 ? "info" : "warn",
        source: "opengoat",
        message:
          result.code === 0
            ? `Streaming session message completed for @${agentId} (session=${sessionRef}).`
            : `Streaming session message completed with code ${result.code} for @${agentId} (session=${sessionRef}).`,
      });
    } catch (error) {
      const streamError =
        error instanceof Error ? error.message : "Unexpected server error";
      deps.logs.append({
        timestamp: new Date().toISOString(),
        level: "error",
        source: "opengoat",
        message: `Streaming session message failed for @${agentId} (session=${sessionRef}): ${streamError}`,
      });
      writeEvent({
        type: "error",
        timestamp: new Date().toISOString(),
        error: streamError,
      });
    } finally {
      raw.off("close", abortRuntimeRun);
      if (logPoller) {
        clearInterval(logPoller);
      }
      if (pollRuntimeLogs) {
        try {
          await pollRuntimeLogs();
        } catch {
          // Best-effort final flush.
        }
      }
      if (!raw.destroyed && !raw.writableEnded) {
        raw.end();
      }
    }
  };

  app.post<{
    Body: { agentId?: string; sessionRef?: string; projectPath?: string; message?: string; images?: UiImageInput[] };
  }>(
    "/api/sessions/message/stream",
    handleSessionMessageStream
  );
  app.post<{
    Body: { agentId?: string; sessionRef?: string; projectPath?: string; message?: string; images?: UiImageInput[] };
  }>(
    "/api/session/message/stream",
    handleSessionMessageStream
  );

}


export async function safeReply<T>(reply: FastifyReply, operation: () => Promise<T>): Promise<T | { error: string }> {
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
