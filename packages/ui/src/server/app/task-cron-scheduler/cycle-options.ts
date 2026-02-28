import type {
  OpenClawUiService,
  UiTaskDelegationStrategiesSettings,
} from "../types.js";
import { DEFAULT_MAX_INACTIVITY_MINUTES } from "../constants.js";
import { toTaskDelegationRuntimeStrategies } from "./strategies/index.js";

type TaskCronCycleOptions = NonNullable<
  Parameters<NonNullable<OpenClawUiService["runTaskCronCycle"]>>[0]
>;

export function buildTaskCronCycleOptions(options: {
  taskDelegationStrategies: UiTaskDelegationStrategiesSettings;
  maxInProgressMinutes: number;
  maxParallelFlows: number;
}): TaskCronCycleOptions {
  return {
    inactiveMinutes: DEFAULT_MAX_INACTIVITY_MINUTES,
    inProgressMinutes: options.maxInProgressMinutes,
    delegationStrategies: toTaskDelegationRuntimeStrategies(
      options.taskDelegationStrategies,
    ),
    maxParallelFlows: options.maxParallelFlows,
  };
}
