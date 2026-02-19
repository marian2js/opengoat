import type {
  OpenClawUiService,
  UiTaskDelegationStrategiesSettings,
} from "../types.js";
import { toTaskDelegationRuntimeStrategies } from "./strategies/index.js";

type TaskCronCycleOptions = NonNullable<
  Parameters<NonNullable<OpenClawUiService["runTaskCronCycle"]>>[0]
>;

export function buildTaskCronCycleOptions(options: {
  taskDelegationStrategies: UiTaskDelegationStrategiesSettings;
  maxInProgressMinutes: number;
  maxParallelFlows: number;
}): TaskCronCycleOptions {
  const bottomUpStrategy = options.taskDelegationStrategies.bottomUp;

  return {
    inactiveMinutes: bottomUpStrategy.maxInactivityMinutes,
    inProgressMinutes: options.maxInProgressMinutes,
    notificationTarget: bottomUpStrategy.inactiveAgentNotificationTarget,
    notifyInactiveAgents: bottomUpStrategy.enabled,
    delegationStrategies: toTaskDelegationRuntimeStrategies(
      options.taskDelegationStrategies,
    ),
    maxParallelFlows: options.maxParallelFlows,
  };
}
