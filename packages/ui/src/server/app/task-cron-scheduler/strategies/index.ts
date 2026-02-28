import type {
  TaskDelegationStrategiesCronOptions,
  UiTaskDelegationStrategiesSettings,
} from "../../types.js";
import {
  describeTopDownTaskDelegationStrategy,
  isSameTopDownTaskDelegationStrategy,
  normalizeTopDownTaskDelegationStrategy,
  toTopDownTaskDelegationRuntimeStrategy,
} from "./top-down.js";

export function normalizeTaskDelegationStrategies(
  value: Partial<UiTaskDelegationStrategiesSettings> | undefined,
  fallback: UiTaskDelegationStrategiesSettings,
): UiTaskDelegationStrategiesSettings {
  return {
    topDown: normalizeTopDownTaskDelegationStrategy(
      value?.topDown,
      fallback.topDown,
    ),
  };
}

export function isSameTaskDelegationStrategies(
  left: UiTaskDelegationStrategiesSettings,
  right: UiTaskDelegationStrategiesSettings,
): boolean {
  return isSameTopDownTaskDelegationStrategy(left.topDown, right.topDown);
}

export function toTaskDelegationRuntimeStrategies(
  value: UiTaskDelegationStrategiesSettings,
): TaskDelegationStrategiesCronOptions {
  return {
    topDown: toTopDownTaskDelegationRuntimeStrategy(value.topDown),
  };
}

export function describeTaskDelegationStrategies(
  value: UiTaskDelegationStrategiesSettings,
): string {
  return describeTopDownTaskDelegationStrategy(value.topDown);
}
