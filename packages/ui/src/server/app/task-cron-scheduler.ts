import type { FastifyInstance } from "fastify";
import { DEFAULT_TASK_CHECK_FREQUENCY_MINUTES } from "./constants.js";
import {
  defaultUiServerSettings,
  isCeoBootstrapPending,
  parseMaxInProgressMinutes,
  parseMaxParallelFlows,
  parseTaskCronEnabled,
  readUiServerSettings,
} from "./settings.js";
import { buildTaskCronCycleOptions } from "./task-cron-scheduler/cycle-options.js";
import { formatTaskCronDispatchLogMessage } from "./task-cron-scheduler/dispatch-log.js";
import {
  describeTaskDelegationStrategies,
  isSameTaskDelegationStrategies,
  normalizeTaskDelegationStrategies,
} from "./task-cron-scheduler/strategies/index.js";
import type {
  OpenClawUiService,
  TaskCronScheduler,
  UiTaskDelegationStrategiesSettings,
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
      setTaskDelegationStrategies: () => {
        // no-op when runtime task cron is unavailable.
      },
      setMaxInProgressMinutes: () => {
        // no-op when runtime task cron is unavailable.
      },
      setMaxParallelFlows: () => {
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
  let taskDelegationStrategies = normalizeTaskDelegationStrategies(
    initialSettings.taskDelegationStrategies,
    defaultUiServerSettings().taskDelegationStrategies,
  );
  let maxInProgressMinutes =
    parseMaxInProgressMinutes(initialSettings.maxInProgressMinutes) ??
    defaultUiServerSettings().maxInProgressMinutes;
  let maxParallelFlows =
    parseMaxParallelFlows(initialSettings.maxParallelFlows) ??
    defaultUiServerSettings().maxParallelFlows;
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

    const persistedTaskCronEnabled =
      parseTaskCronEnabled(persisted.taskCronEnabled) ?? taskCronEnabled;
    const persistedTaskDelegationStrategies = normalizeTaskDelegationStrategies(
      persisted.taskDelegationStrategies,
      taskDelegationStrategies,
    );
    const persistedMaxInProgressMinutes =
      parseMaxInProgressMinutes(persisted.maxInProgressMinutes) ??
      maxInProgressMinutes;
    const persistedMaxParallelFlows =
      parseMaxParallelFlows(persisted.maxParallelFlows) ?? maxParallelFlows;

    const hasTaskCronEnabledChange = persistedTaskCronEnabled !== taskCronEnabled;
    const hasTaskDelegationStrategiesChange = !isSameTaskDelegationStrategies(
      persistedTaskDelegationStrategies,
      taskDelegationStrategies,
    );
    const hasMaxInProgressChange =
      persistedMaxInProgressMinutes !== maxInProgressMinutes;
    const hasMaxParallelFlowsChange =
      persistedMaxParallelFlows !== maxParallelFlows;
    if (
      !hasTaskCronEnabledChange &&
      !hasTaskDelegationStrategiesChange &&
      !hasMaxInProgressChange &&
      !hasMaxParallelFlowsChange
    ) {
      return;
    }

    taskCronEnabled = persistedTaskCronEnabled;
    taskDelegationStrategies = persistedTaskDelegationStrategies;
    maxInProgressMinutes = persistedMaxInProgressMinutes;
    maxParallelFlows = persistedMaxParallelFlows;
    if (hasTaskCronEnabledChange) {
      schedule();
    }
    app.log.info(
      {
        taskCronEnabled,
        taskDelegationStrategies,
        maxInProgressMinutes,
        maxParallelFlows,
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
      const cycle = await service.runTaskCronCycle?.(
        buildTaskCronCycleOptions({
          taskDelegationStrategies,
          maxInProgressMinutes,
          maxParallelFlows,
        }),
      );
      if (cycle) {
        const doingTasks = cycle.doingTasks ?? 0;
        app.log.info(
          {
            ranAt: cycle.ranAt,
            scanned: cycle.scannedTasks,
            todo: cycle.todoTasks,
            doing: doingTasks,
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
          message: `[task-cron] cycle completed ran=${cycle.ranAt} scanned=${cycle.scannedTasks} todo=${cycle.todoTasks} doing=${doingTasks} blocked=${cycle.blockedTasks} inactive=${cycle.inactiveAgents} sent=${cycle.sent} failed=${cycle.failed}`,
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
      app.log.info("[task-cron] scheduler resumed after Goat bootstrap completion");
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message:
          "[task-cron] scheduler resumed after first Goat message completed bootstrap.",
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
    setTaskDelegationStrategies: (nextStrategies: UiTaskDelegationStrategiesSettings) => {
      const nextTaskDelegationStrategies = normalizeTaskDelegationStrategies(
        nextStrategies,
        taskDelegationStrategies,
      );
      if (
        isSameTaskDelegationStrategies(
          nextTaskDelegationStrategies,
          taskDelegationStrategies,
        )
      ) {
        return;
      }
      taskDelegationStrategies = nextTaskDelegationStrategies;
      app.log.info(
        {
          taskDelegationStrategies,
        },
        "[task-cron] task delegation strategies updated",
      );
      logs.append({
        timestamp: new Date().toISOString(),
        level: "info",
        source: "opengoat",
        message: `[task-cron] ${describeTaskDelegationStrategies(taskDelegationStrategies)}.`,
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
    stop: () => {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = undefined;
      }
      stopBootstrapCheck();
    },
  };
}
