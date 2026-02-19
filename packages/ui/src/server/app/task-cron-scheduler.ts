import type { FastifyInstance } from "fastify";
import { DEFAULT_TASK_CHECK_FREQUENCY_MINUTES } from "./constants.js";
import {
  defaultUiServerSettings,
  isCeoBootstrapPending,
  parseInactiveAgentNotificationTarget,
  parseMaxInactivityMinutes,
  parseMaxInProgressMinutes,
  parseMaxParallelFlows,
  parseNotifyManagersOfInactiveAgents,
  parseTaskCronEnabled,
  readUiServerSettings,
} from "./settings.js";
import { formatUiLogQuotedPreview } from "./text.js";
import type {
  InactiveAgentNotificationTarget,
  TaskCronDispatchResult,
  OpenClawUiService,
  TaskCronScheduler,
  UiLogBuffer,
  UiServerSettings,
} from "./types.js";

export function createTaskCronScheduler(
  app: FastifyInstance,
  service: OpenClawUiService,
  initialSettings: UiServerSettings,
  logs: UiLogBuffer,
): TaskCronScheduler {
  if (typeof service.runTaskCronCycle !== "function") {
    return {
      setTaskCronEnabled: () => {
        // no-op when runtime task cron is unavailable.
      },
      setNotifyManagersOfInactiveAgents: () => {
        // no-op when runtime task cron is unavailable.
      },
      setMaxInactivityMinutes: () => {
        // no-op when runtime task cron is unavailable.
      },
      setMaxInProgressMinutes: () => {
        // no-op when runtime task cron is unavailable.
      },
      setMaxParallelFlows: () => {
        // no-op when runtime task cron is unavailable.
      },
      setInactiveAgentNotificationTarget: () => {
        // no-op when runtime task cron is unavailable.
      },
      stop: () => {
        // no-op when runtime task cron is unavailable.
      },
    };
  }

  let taskCronEnabled =
    parseTaskCronEnabled(initialSettings.taskCronEnabled) ??
    defaultUiServerSettings().taskCronEnabled;
  let notifyManagersOfInactiveAgents =
    parseNotifyManagersOfInactiveAgents(
      initialSettings.notifyManagersOfInactiveAgents,
    ) ?? defaultUiServerSettings().notifyManagersOfInactiveAgents;
  let maxInactivityMinutes =
    parseMaxInactivityMinutes(initialSettings.maxInactivityMinutes) ??
    defaultUiServerSettings().maxInactivityMinutes;
  let maxInProgressMinutes =
    parseMaxInProgressMinutes(initialSettings.maxInProgressMinutes) ??
    defaultUiServerSettings().maxInProgressMinutes;
  let maxParallelFlows =
    parseMaxParallelFlows(initialSettings.maxParallelFlows) ??
    defaultUiServerSettings().maxParallelFlows;
  let inactiveAgentNotificationTarget =
    parseInactiveAgentNotificationTarget(
      initialSettings.inactiveAgentNotificationTarget,
    ) ?? defaultUiServerSettings().inactiveAgentNotificationTarget;
  const homeDir = service.getHomeDir();
  let intervalHandle: NodeJS.Timeout | undefined;
  let bootstrapCheckHandle: NodeJS.Timeout | undefined;
  let running = false;

  const syncFromPersistedSettings = async (): Promise<void> => {
    const persisted = await readUiServerSettings(service.getHomeDir()).catch(() => {
      return null;
    });
    if (!persisted) {
      return;
    }

    const persistedNotifyManagers =
      parseNotifyManagersOfInactiveAgents(
        persisted.notifyManagersOfInactiveAgents,
      ) ?? notifyManagersOfInactiveAgents;
    const persistedTaskCronEnabled =
      parseTaskCronEnabled(persisted.taskCronEnabled) ?? taskCronEnabled;
    const persistedMaxInactivityMinutes =
      parseMaxInactivityMinutes(persisted.maxInactivityMinutes) ??
      maxInactivityMinutes;
    const persistedMaxInProgressMinutes =
      parseMaxInProgressMinutes(persisted.maxInProgressMinutes) ??
      maxInProgressMinutes;
    const persistedMaxParallelFlows =
      parseMaxParallelFlows(persisted.maxParallelFlows) ?? maxParallelFlows;
    const persistedNotificationTarget =
      parseInactiveAgentNotificationTarget(
        persisted.inactiveAgentNotificationTarget,
      ) ?? inactiveAgentNotificationTarget;

    const hasTaskCronEnabledChange = persistedTaskCronEnabled !== taskCronEnabled;
    const hasNotifyManagersChange =
      persistedNotifyManagers !== notifyManagersOfInactiveAgents;
    const hasMaxInactivityChange =
      persistedMaxInactivityMinutes !== maxInactivityMinutes;
    const hasMaxInProgressChange =
      persistedMaxInProgressMinutes !== maxInProgressMinutes;
    const hasMaxParallelFlowsChange =
      persistedMaxParallelFlows !== maxParallelFlows;
    const hasNotificationTargetChange =
      persistedNotificationTarget !== inactiveAgentNotificationTarget;
    if (
      !hasTaskCronEnabledChange &&
      !hasNotifyManagersChange &&
      !hasMaxInactivityChange &&
      !hasMaxInProgressChange &&
      !hasMaxParallelFlowsChange &&
      !hasNotificationTargetChange
    ) {
      return;
    }

    taskCronEnabled = persistedTaskCronEnabled;
    notifyManagersOfInactiveAgents = persistedNotifyManagers;
    maxInactivityMinutes = persistedMaxInactivityMinutes;
    maxInProgressMinutes = persistedMaxInProgressMinutes;
    maxParallelFlows = persistedMaxParallelFlows;
    inactiveAgentNotificationTarget = persistedNotificationTarget;
    if (hasTaskCronEnabledChange) {
      schedule();
    }
    app.log.info(
      {
        taskCronEnabled,
        notifyManagersOfInactiveAgents,
        maxInactivityMinutes,
        maxInProgressMinutes,
        maxParallelFlows,
        inactiveAgentNotificationTarget,
      },
      "[task-cron] scheduler synchronized from persisted settings",
    );
  };

  const runCycle = async (): Promise<void> => {
    if (running) {
      return;
    }
    running = true;
    try {
      await syncFromPersistedSettings();
      if (!taskCronEnabled) {
        return;
      }
      if (isCeoBootstrapPending(homeDir)) {
        schedule();
        return;
      }
      const cycle = await service.runTaskCronCycle?.({
        inactiveMinutes: maxInactivityMinutes,
        inProgressMinutes: maxInProgressMinutes,
        notificationTarget: inactiveAgentNotificationTarget,
        notifyInactiveAgents: notifyManagersOfInactiveAgents,
        maxParallelFlows,
      });
      if (cycle) {
        app.log.info(
          {
            ranAt: cycle.ranAt,
            scanned: cycle.scannedTasks,
            todo: cycle.todoTasks,
            doing: cycle.doingTasks,
            blocked: cycle.blockedTasks,
            inactive: cycle.inactiveAgents,
            maxParallelFlows,
            sent: cycle.sent,
            failed: cycle.failed,
          },
          "[task-cron] cycle completed",
        );
        logs.append({
          timestamp: new Date().toISOString(),
          level: cycle.failed > 0 ? "warn" : "info",
          source: "opengoat",
          message: `[task-cron] cycle completed ran=${cycle.ranAt} scanned=${cycle.scannedTasks} todo=${cycle.todoTasks} doing=${cycle.doingTasks} blocked=${cycle.blockedTasks} inactive=${cycle.inactiveAgents} sent=${cycle.sent} failed=${cycle.failed}`,
        });
        for (const dispatch of cycle.dispatches ?? []) {
          logs.append({
            timestamp: new Date().toISOString(),
            level: dispatch.ok ? "info" : "warn",
            source: "opengoat",
            message: formatTaskCronDispatchLogMessage(dispatch),
          });
        }
      }
    } catch (error) {
      app.log.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        "[task-cron] cycle failed",
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "error",
        source: "opengoat",
        message:
          error instanceof Error
            ? `[task-cron] cycle failed: ${error.message}`
            : "[task-cron] cycle failed.",
      });
    } finally {
      running = false;
    }
  };

  const stopBootstrapCheck = (): void => {
    if (bootstrapCheckHandle) {
      clearInterval(bootstrapCheckHandle);
      bootstrapCheckHandle = undefined;
    }
  };

  const ensureBootstrapCheck = (): void => {
    if (bootstrapCheckHandle) {
      return;
    }
    bootstrapCheckHandle = setInterval(() => {
      if (!taskCronEnabled) {
        stopBootstrapCheck();
        return;
      }
      if (isCeoBootstrapPending(homeDir)) {
        return;
      }
      stopBootstrapCheck();
      app.log.info("[task-cron] scheduler resumed after CEO bootstrap completion");
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message:
          "[task-cron] scheduler resumed after first CEO message completed bootstrap.",
      });
      schedule();
    }, DEFAULT_TASK_CHECK_FREQUENCY_MINUTES * 60_000);
    bootstrapCheckHandle.unref?.();
  };

  const schedule = (): void => {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = undefined;
    }
    if (!taskCronEnabled) {
      stopBootstrapCheck();
      return;
    }
    if (isCeoBootstrapPending(homeDir)) {
      ensureBootstrapCheck();
      return;
    }
    stopBootstrapCheck();
    intervalHandle = setInterval(() => {
      void runCycle();
    }, DEFAULT_TASK_CHECK_FREQUENCY_MINUTES * 60_000);
    intervalHandle.unref?.();
  };

  schedule();

  return {
    setTaskCronEnabled: (nextEnabled: boolean) => {
      const parsed = parseTaskCronEnabled(nextEnabled);
      if (parsed === undefined || parsed === taskCronEnabled) {
        return;
      }
      taskCronEnabled = parsed;
      schedule();
      app.log.info(
        {
          taskCronEnabled,
        },
        "[task-cron] scheduler state updated",
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] automation checks ${taskCronEnabled ? "enabled" : "disabled"}.`,
      });
    },
    setNotifyManagersOfInactiveAgents: (nextEnabled: boolean) => {
      const parsed = parseNotifyManagersOfInactiveAgents(nextEnabled);
      if (parsed === undefined || parsed === notifyManagersOfInactiveAgents) {
        return;
      }
      notifyManagersOfInactiveAgents = parsed;
      app.log.info(
        {
          notifyManagersOfInactiveAgents,
        },
        "[task-cron] inactivity notification state updated",
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] inactive-manager notifications ${notifyManagersOfInactiveAgents ? "enabled" : "disabled"}.`,
      });
    },
    setMaxInactivityMinutes: (nextMaxInactivityMinutes: number) => {
      const parsed = parseMaxInactivityMinutes(nextMaxInactivityMinutes);
      if (!parsed || parsed === maxInactivityMinutes) {
        return;
      }
      maxInactivityMinutes = parsed;
      app.log.info(
        {
          maxInactivityMinutes,
        },
        "[task-cron] inactivity threshold updated",
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] inactivity threshold updated to ${maxInactivityMinutes} minute(s).`,
      });
    },
    setMaxInProgressMinutes: (nextMaxInProgressMinutes: number) => {
      const parsed = parseMaxInProgressMinutes(nextMaxInProgressMinutes);
      if (!parsed || parsed === maxInProgressMinutes) {
        return;
      }
      maxInProgressMinutes = parsed;
      app.log.info(
        {
          maxInProgressMinutes,
        },
        "[task-cron] in-progress timeout updated",
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] in-progress timeout updated to ${maxInProgressMinutes} minute(s).`,
      });
    },
    setMaxParallelFlows: (nextMaxParallelFlows: number) => {
      const parsed = parseMaxParallelFlows(nextMaxParallelFlows);
      if (!parsed || parsed === maxParallelFlows) {
        return;
      }
      maxParallelFlows = parsed;
      app.log.info(
        {
          maxParallelFlows,
        },
        "[task-cron] max parallel flows updated",
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] max parallel flows updated to ${maxParallelFlows}.`,
      });
    },
    setInactiveAgentNotificationTarget: (
      nextTarget: InactiveAgentNotificationTarget,
    ) => {
      const parsed = parseInactiveAgentNotificationTarget(nextTarget);
      if (!parsed || parsed === inactiveAgentNotificationTarget) {
        return;
      }
      inactiveAgentNotificationTarget = parsed;
      app.log.info(
        {
          inactiveAgentNotificationTarget,
        },
        "[task-cron] inactivity notification target updated",
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] inactivity notification target set to ${inactiveAgentNotificationTarget}.`,
      });
    },
    stop: () => {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = undefined;
      }
      stopBootstrapCheck();
    },
  };
}

function formatTaskCronDispatchLogMessage(
  dispatch: TaskCronDispatchResult,
): string {
  const messagePreview = formatUiLogQuotedPreview(dispatch.message ?? "");
  const taskSuffix = dispatch.taskId ? ` task=${dispatch.taskId}` : "";
  const subjectSuffix = dispatch.subjectAgentId
    ? ` subject=@${dispatch.subjectAgentId}`
    : "";
  const previewSuffix = messagePreview ? ` message="${messagePreview}"` : "";
  const sessionSuffix = ` session=${dispatch.sessionRef}`;
  const target = `@${dispatch.targetAgentId}`;
  if (!dispatch.ok) {
    const errorPreview = formatUiLogQuotedPreview(dispatch.error ?? "", 160);
    const errorSuffix = errorPreview ? ` error="${errorPreview}"` : "";
    return `[task-cron] Failed to deliver ${dispatch.kind} message to ${target}.${taskSuffix}${subjectSuffix}${sessionSuffix}${previewSuffix}${errorSuffix}`;
  }
  return `[task-cron] Agent ${target} received ${dispatch.kind} message.${taskSuffix}${subjectSuffix}${sessionSuffix}${previewSuffix}`;
}
