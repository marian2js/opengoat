import {
  parseBooleanSetting,
  parseInactiveAgentNotificationTarget,
  parseMaxInactivityMinutes,
} from "../../settings.js";
import type { UiTaskDelegationStrategiesSettings } from "../../types.js";

type BottomUpTaskDelegationSettings =
  UiTaskDelegationStrategiesSettings["bottomUp"];

export function normalizeBottomUpTaskDelegationStrategy(
  value: Partial<BottomUpTaskDelegationSettings> | undefined,
  fallback: BottomUpTaskDelegationSettings,
): BottomUpTaskDelegationSettings {
  return {
    enabled: parseBooleanSetting(value?.enabled) ?? fallback.enabled,
    maxInactivityMinutes:
      parseMaxInactivityMinutes(value?.maxInactivityMinutes) ??
      fallback.maxInactivityMinutes,
    inactiveAgentNotificationTarget:
      parseInactiveAgentNotificationTarget(
        value?.inactiveAgentNotificationTarget,
      ) ?? fallback.inactiveAgentNotificationTarget,
  };
}

export function isSameBottomUpTaskDelegationStrategy(
  left: BottomUpTaskDelegationSettings,
  right: BottomUpTaskDelegationSettings,
): boolean {
  return (
    left.enabled === right.enabled &&
    left.maxInactivityMinutes === right.maxInactivityMinutes &&
    left.inactiveAgentNotificationTarget === right.inactiveAgentNotificationTarget
  );
}

export function toBottomUpTaskDelegationRuntimeStrategy(
  value: BottomUpTaskDelegationSettings,
): {
  enabled: boolean;
  inactiveMinutes: number;
  notificationTarget: "all-managers" | "goat-only";
} {
  return {
    enabled: value.enabled,
    inactiveMinutes: value.maxInactivityMinutes,
    notificationTarget: value.inactiveAgentNotificationTarget,
  };
}

export function describeBottomUpTaskDelegationStrategy(
  value: BottomUpTaskDelegationSettings,
): string {
  return `bottom-up task delegation ${
    value.enabled ? "enabled" : "disabled"
  } (max inactivity ${value.maxInactivityMinutes}m, audience ${value.inactiveAgentNotificationTarget})`;
}
