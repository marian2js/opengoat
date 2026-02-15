import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createOpenGoatRuntime } from "@opengoat/core";
import { createUiAuthController } from "./app/auth.js";
import { registerFrontend } from "./app/frontend.js";
import { createUiLogBuffer } from "./app/log-buffer.js";
import { registerApiRoutes } from "./app/routes.js";
import { extractRuntimeActivityFromLogLines } from "./app/runtime-logs.js";
import { readUiServerSettings, writeUiServerSettings } from "./app/settings.js";
import { ensureDefaultOrganizationWorkspace } from "./app/session.js";
import { createTaskCronScheduler } from "./app/task-cron-scheduler.js";
import { stripQueryStringFromUrl } from "./app/text.js";
import { createVersionInfoProvider, resolveMode, resolvePackageRoot } from "./app/version.js";
import type {
  OpenClawUiService,
  OpenGoatUiServerOptions,
} from "./app/types.js";

export type { OpenClawUiService } from "./app/types.js";
export { extractRuntimeActivityFromLogLines };

export async function createOpenGoatUiServer(
  options: OpenGoatUiServerOptions = {},
): Promise<FastifyInstance> {
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

  const logs = createUiLogBuffer(service);
  logs.append({
    timestamp: new Date().toISOString(),
    level: "info",
    source: "opengoat",
    message: "OpenGoat UI server started.",
  });
  logs.start();
  await ensureDefaultOrganizationWorkspace(service, logs);

  let uiSettings = await readUiServerSettings(service.getHomeDir());
  const auth = createUiAuthController(app, () => uiSettings.authentication);
  const getVersionInfo = createVersionInfoProvider();
  const taskCronScheduler = createTaskCronScheduler(app, service, uiSettings, logs);

  app.addHook("onClose", async () => {
    taskCronScheduler.stop();
    logs.stop();
  });

  await app.register(cors, { origin: true });
  app.addHook("onRequest", async (request, reply) => {
    if (!auth.isAuthenticationRequired()) {
      return;
    }

    const pathname = stripQueryStringFromUrl(request.url);
    if (
      pathname === "/api/auth/status" ||
      pathname === "/api/auth/login" ||
      pathname === "/api/auth/logout"
    ) {
      return;
    }

    if (!pathname.startsWith("/api/")) {
      return;
    }

    if (auth.isAuthenticatedRequest(request)) {
      return;
    }

    reply.code(401).send({
      error: "Authentication required.",
      code: "AUTH_REQUIRED",
    });
  });

  registerApiRoutes(app, service, mode, {
    getSettings: () => uiSettings,
    updateSettings: async (nextSettings) => {
      const previousAuth = uiSettings.authentication;
      uiSettings = nextSettings;
      await writeUiServerSettings(service.getHomeDir(), uiSettings);
      auth.handleSettingsMutation(previousAuth, uiSettings.authentication);
      taskCronScheduler.setTaskCronEnabled(uiSettings.taskCronEnabled);
      taskCronScheduler.setNotifyManagersOfInactiveAgents(
        uiSettings.notifyManagersOfInactiveAgents,
      );
      taskCronScheduler.setMaxInactivityMinutes(uiSettings.maxInactivityMinutes);
      taskCronScheduler.setMaxParallelFlows(uiSettings.maxParallelFlows);
      taskCronScheduler.setInactiveAgentNotificationTarget(
        uiSettings.inactiveAgentNotificationTarget,
      );
    },
    getVersionInfo,
    logs,
    auth,
  });

  if (attachFrontend) {
    await registerFrontend(app, {
      packageRoot,
      mode,
    });
  }

  return app;
}
