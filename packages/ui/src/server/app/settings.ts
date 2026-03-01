import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_LOG_STREAM_LIMIT,
  DEFAULT_MAX_IN_PROGRESS_MINUTES,
  DEFAULT_MAX_PARALLEL_FLOWS,
  DEFAULT_TOP_DOWN_OPEN_TASKS_THRESHOLD,
  MAX_LOG_STREAM_LIMIT,
  MAX_MAX_IN_PROGRESS_MINUTES,
  MAX_MAX_PARALLEL_FLOWS,
  MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD,
  MIN_MAX_IN_PROGRESS_MINUTES,
  MIN_MAX_PARALLEL_FLOWS,
  MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD,
  UI_SETTINGS_FILENAME,
} from "./constants.js";
import {
  normalizeUiAuthenticationPasswordHash,
  normalizeUiAuthenticationUsername,
} from "./auth.js";
import { DEFAULT_AGENT_ID } from "./constants.js";
import type {
  UiAuthenticationSettingsResponse,
  UiOnboardingSettings,
  UiServerSettings,
  UiServerSettingsResponse,
  UiTopDownTaskDelegationStrategySettings,
  UiTaskDelegationStrategiesSettings,
} from "./types.js";

export function defaultUiServerSettings(): UiServerSettings {
  return {
    taskCronEnabled: true,
    maxInProgressMinutes: DEFAULT_MAX_IN_PROGRESS_MINUTES,
    maxParallelFlows: DEFAULT_MAX_PARALLEL_FLOWS,
    taskDelegationStrategies: defaultTaskDelegationStrategies(),
    authentication: {
      enabled: false,
      username: undefined,
      passwordHash: undefined,
    },
    onboarding: {
      completed: false,
      completedAt: undefined,
      executionProviderId: undefined,
    },
  };
}

export function parseBooleanSetting(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  return undefined;
}

export function parseTaskCronEnabled(value: unknown): boolean | undefined {
  return parseBooleanSetting(value);
}

export function defaultTopDownTaskDelegationStrategySettings(): UiTopDownTaskDelegationStrategySettings {
  return {
    enabled: true,
    openTasksThreshold: DEFAULT_TOP_DOWN_OPEN_TASKS_THRESHOLD,
  };
}

export function defaultTaskDelegationStrategies(): UiTaskDelegationStrategiesSettings {
  return {
    topDown: defaultTopDownTaskDelegationStrategySettings(),
  };
}

export function parseUiLogStreamLimit(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_LOG_STREAM_LIMIT;
  }
  return Math.min(parsed, MAX_LOG_STREAM_LIMIT);
}

export function parseUiLogStreamFollow(value: unknown): boolean {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
  }
  return true;
}

export function parseMaxInProgressMinutes(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  if (
    parsed < MIN_MAX_IN_PROGRESS_MINUTES ||
    parsed > MAX_MAX_IN_PROGRESS_MINUTES
  ) {
    return undefined;
  }
  return parsed;
}

export function parseMaxParallelFlows(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  if (parsed < MIN_MAX_PARALLEL_FLOWS || parsed > MAX_MAX_PARALLEL_FLOWS) {
    return undefined;
  }
  return parsed;
}

export function parseTopDownOpenTasksThreshold(
  value: unknown,
): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  if (
    parsed < MIN_TOP_DOWN_OPEN_TASKS_THRESHOLD ||
    parsed > MAX_TOP_DOWN_OPEN_TASKS_THRESHOLD
  ) {
    return undefined;
  }
  return parsed;
}

export async function readUiServerSettings(homeDir: string): Promise<UiServerSettings> {
  const settingsPath = path.resolve(homeDir, UI_SETTINGS_FILENAME);
  const defaults = defaultUiServerSettings();
  const legacyDefaultOnboarding = resolveLegacyOnboardingDefault(homeDir);
  if (!existsSync(settingsPath)) {
    return {
      ...defaults,
      onboarding: legacyDefaultOnboarding,
    };
  }

  try {
    const raw = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as {
      taskCronEnabled?: unknown;
      maxInProgressMinutes?: unknown;
      maxParallelFlows?: unknown;
      taskDelegationStrategies?: {
        topDown?: {
          enabled?: unknown;
          openTasksThreshold?: unknown;
        };
      };
      authentication?: {
        enabled?: unknown;
        username?: unknown;
        passwordHash?: unknown;
      };
      onboarding?: {
        completed?: unknown;
        completedAt?: unknown;
        executionProviderId?: unknown;
      };
    };
    const taskCronEnabled = parseTaskCronEnabled(parsed?.taskCronEnabled);
    const maxInProgressMinutes = parseMaxInProgressMinutes(
      parsed?.maxInProgressMinutes,
    );
    const maxParallelFlows = parseMaxParallelFlows(parsed?.maxParallelFlows);
    const authEnabled = parseBooleanSetting(parsed.authentication?.enabled);
    const authUsername = normalizeUiAuthenticationUsername(
      parsed.authentication?.username,
    );
    const authPasswordHash = normalizeUiAuthenticationPasswordHash(
      parsed.authentication?.passwordHash,
    );
    const parsedTopDown = parsed.taskDelegationStrategies?.topDown;
    const parsedTopDownEnabled = parseBooleanSetting(parsedTopDown?.enabled);
    const parsedTopDownOpenTasksThreshold = parseTopDownOpenTasksThreshold(
      parsedTopDown?.openTasksThreshold,
    );

    const defaultTopDown = defaults.taskDelegationStrategies.topDown;
    const topDownEnabled = parsedTopDownEnabled ?? defaultTopDown.enabled;
    const topDownOpenTasksThreshold =
      parsedTopDownOpenTasksThreshold ?? defaultTopDown.openTasksThreshold;

    return {
      taskCronEnabled: taskCronEnabled ?? defaults.taskCronEnabled,
      maxInProgressMinutes:
        maxInProgressMinutes ?? defaults.maxInProgressMinutes,
      maxParallelFlows: maxParallelFlows ?? defaults.maxParallelFlows,
      taskDelegationStrategies: {
        topDown: {
          enabled: topDownEnabled,
          openTasksThreshold: topDownOpenTasksThreshold,
        },
      },
      authentication: {
        enabled: authEnabled === true && Boolean(authUsername && authPasswordHash),
        username: authUsername,
        passwordHash: authPasswordHash,
      },
      onboarding: normalizeUiOnboardingSettings(
        parsed.onboarding,
        legacyDefaultOnboarding,
      ),
    };
  } catch {
    return {
      ...defaults,
      onboarding: legacyDefaultOnboarding,
    };
  }
}

export async function writeUiServerSettings(
  homeDir: string,
  settings: UiServerSettings,
): Promise<void> {
  const settingsPath = path.resolve(homeDir, UI_SETTINGS_FILENAME);
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

export function resolveCeoBootstrapPath(homeDir: string): string {
  return path.resolve(homeDir, "workspaces", DEFAULT_AGENT_ID, "BOOTSTRAP.md");
}

export function isCeoBootstrapPending(homeDir: string): boolean {
  return existsSync(resolveCeoBootstrapPath(homeDir));
}

export function toPublicUiServerSettings(
  settings: UiServerSettings,
  authentication: UiAuthenticationSettingsResponse,
  options: { ceoBootstrapPending?: boolean } = {},
): UiServerSettingsResponse {
  return {
    taskCronEnabled: settings.taskCronEnabled,
    maxInProgressMinutes: settings.maxInProgressMinutes,
    maxParallelFlows: settings.maxParallelFlows,
    taskDelegationStrategies: settings.taskDelegationStrategies,
    authentication,
    ceoBootstrapPending: options.ceoBootstrapPending ?? false,
    onboarding: {
      completed: settings.onboarding.completed,
      completedAt: settings.onboarding.completedAt,
      executionProviderId: settings.onboarding.executionProviderId,
    },
  };
}

function resolveLegacyOnboardingDefault(homeDir: string): UiOnboardingSettings {
  const legacyCompleted = !isCeoBootstrapPending(homeDir);
  return {
    completed: legacyCompleted,
    completedAt: undefined,
    executionProviderId: undefined,
  };
}

function normalizeUiOnboardingSettings(
  value: {
    completed?: unknown;
    completedAt?: unknown;
    executionProviderId?: unknown;
  } | undefined,
  defaults: UiOnboardingSettings,
): UiOnboardingSettings {
  const completed =
    typeof value?.completed === "boolean"
      ? value.completed
      : defaults.completed;
  const completedAt =
    typeof value?.completedAt === "string" && value.completedAt.trim()
      ? value.completedAt.trim()
      : defaults.completedAt;
  const executionProviderId =
    typeof value?.executionProviderId === "string" &&
    value.executionProviderId.trim()
      ? value.executionProviderId.trim().toLowerCase()
      : defaults.executionProviderId;

  return {
    completed,
    completedAt,
    executionProviderId,
  };
}
