import type {
  TaskDelegationStrategiesCronOptions,
  UiTaskDelegationStrategiesSettings,
} from "../../types.js";
import {
  describeBottomUpTaskDelegationStrategy,
  isSameBottomUpTaskDelegationStrategy,
  normalizeBottomUpTaskDelegationStrategy,
  toBottomUpTaskDelegationRuntimeStrategy,
} from "./bottom-up.js";
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
    bottomUp: normalizeBottomUpTaskDelegationStrategy(
      value?.bottomUp,
      fallback.bottomUp,
    ),
  };
}

export function isSameTaskDelegationStrategies(
  left: UiTaskDelegationStrategiesSettings,
  right: UiTaskDelegationStrategiesSettings,
): boolean {
  return (
    isSameTopDownTaskDelegationStrategy(left.topDown, right.topDown) &&
    isSameBottomUpTaskDelegationStrategy(left.bottomUp, right.bottomUp)
  );
}

export function toTaskDelegationRuntimeStrategies(
  value: UiTaskDelegationStrategiesSettings,
): TaskDelegationStrategiesCronOptions {
  return {
    topDown: toTopDownTaskDelegationRuntimeStrategy(value.topDown),
    bottomUp: toBottomUpTaskDelegationRuntimeStrategy(value.bottomUp),
  };
}

export function describeTaskDelegationStrategies(
  value: UiTaskDelegationStrategiesSettings,
): string {
  return [
    describeTopDownTaskDelegationStrategy(value.topDown),
    describeBottomUpTaskDelegationStrategy(value.bottomUp),
  ].join("; ");
}
