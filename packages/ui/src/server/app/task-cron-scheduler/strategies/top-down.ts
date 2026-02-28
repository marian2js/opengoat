import {
  parseBooleanSetting,
  parseTopDownOpenTasksThreshold,
} from "../../settings.js";
import type { UiTaskDelegationStrategiesSettings } from "../../types.js";

type TopDownTaskDelegationSettings =
  UiTaskDelegationStrategiesSettings["topDown"];

export function normalizeTopDownTaskDelegationStrategy(
  value: Partial<TopDownTaskDelegationSettings> | undefined,
  fallback: TopDownTaskDelegationSettings,
): TopDownTaskDelegationSettings {
  return {
    enabled: parseBooleanSetting(value?.enabled) ?? fallback.enabled,
    openTasksThreshold:
      parseTopDownOpenTasksThreshold(value?.openTasksThreshold) ??
      fallback.openTasksThreshold,
  };
}

export function isSameTopDownTaskDelegationStrategy(
  left: TopDownTaskDelegationSettings,
  right: TopDownTaskDelegationSettings,
): boolean {
  return (
    left.enabled === right.enabled &&
    left.openTasksThreshold === right.openTasksThreshold
  );
}

export function toTopDownTaskDelegationRuntimeStrategy(
  value: TopDownTaskDelegationSettings,
): {
  enabled: boolean;
  openTasksThreshold: number;
} {
  return {
    enabled: value.enabled,
    openTasksThreshold: value.openTasksThreshold,
  };
}

export function describeTopDownTaskDelegationStrategy(
  value: TopDownTaskDelegationSettings,
): string {
  return `product manager task refill ${
    value.enabled ? "enabled" : "disabled"
  } (open task threshold ${value.openTasksThreshold})`;
}
