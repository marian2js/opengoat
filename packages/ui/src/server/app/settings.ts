import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_LOG_STREAM_LIMIT,
  DEFAULT_MAX_INACTIVITY_MINUTES,
  MAX_LOG_STREAM_LIMIT,
  MAX_MAX_INACTIVITY_MINUTES,
  MIN_MAX_INACTIVITY_MINUTES,
  UI_SETTINGS_FILENAME,
} from "./constants.js";
import {
  normalizeUiAuthenticationPasswordHash,
  normalizeUiAuthenticationUsername,
} from "./auth.js";
import { DEFAULT_AGENT_ID } from "./constants.js";
import type {
  InactiveAgentNotificationTarget,
  UiAuthenticationSettingsResponse,
  UiServerSettings,
  UiServerSettingsResponse,
} from "./types.js";

export function defaultUiServerSettings(): UiServerSettings {
  return {
    taskCronEnabled: true,
    notifyManagersOfInactiveAgents: true,
    maxInactivityMinutes: DEFAULT_MAX_INACTIVITY_MINUTES,
    inactiveAgentNotificationTarget: "all-managers",
    authentication: {
      enabled: false,
      username: undefined,
      passwordHash: undefined,
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

export function parseNotifyManagersOfInactiveAgents(
  value: unknown,
): boolean | undefined {
  return parseBooleanSetting(value);
}

export function parseTaskCronEnabled(value: unknown): boolean | undefined {
  return parseBooleanSetting(value);
}

export function parseInactiveAgentNotificationTarget(
  value: unknown,
): InactiveAgentNotificationTarget | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "all-managers") {
    return "all-managers";
  }
  if (normalized === "ceo-only") {
    return "ceo-only";
  }
  return undefined;
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

export function parseMaxInactivityMinutes(value: unknown): number | undefined {
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
    parsed < MIN_MAX_INACTIVITY_MINUTES ||
    parsed > MAX_MAX_INACTIVITY_MINUTES
  ) {
    return undefined;
  }
  return parsed;
}

export async function readUiServerSettings(homeDir: string): Promise<UiServerSettings> {
  const settingsPath = path.resolve(homeDir, UI_SETTINGS_FILENAME);
  if (!existsSync(settingsPath)) {
    return defaultUiServerSettings();
  }

  try {
    const raw = await readFile(settingsPath, "utf8");
    const parsed = JSON.parse(raw) as {
      taskCronEnabled?: unknown;
      notifyManagersOfInactiveAgents?: unknown;
      maxInactivityMinutes?: unknown;
      inactiveAgentNotificationTarget?: unknown;
      authentication?: {
        enabled?: unknown;
        username?: unknown;
        passwordHash?: unknown;
      };
    };
    const taskCronEnabled = parseTaskCronEnabled(parsed?.taskCronEnabled);
    const notifyManagersOfInactiveAgents =
      parseNotifyManagersOfInactiveAgents(parsed?.notifyManagersOfInactiveAgents) ??
      taskCronEnabled;
    const maxInactivityMinutes = parseMaxInactivityMinutes(
      parsed?.maxInactivityMinutes,
    );
    const inactiveAgentNotificationTarget = parseInactiveAgentNotificationTarget(
      parsed?.inactiveAgentNotificationTarget,
    );
    const authEnabled = parseBooleanSetting(parsed.authentication?.enabled);
    const authUsername = normalizeUiAuthenticationUsername(
      parsed.authentication?.username,
    );
    const authPasswordHash = normalizeUiAuthenticationPasswordHash(
      parsed.authentication?.passwordHash,
    );
    const defaults = defaultUiServerSettings();
    return {
      taskCronEnabled: taskCronEnabled ?? defaults.taskCronEnabled,
      notifyManagersOfInactiveAgents:
        notifyManagersOfInactiveAgents ?? defaults.notifyManagersOfInactiveAgents,
      maxInactivityMinutes: maxInactivityMinutes ?? defaults.maxInactivityMinutes,
      inactiveAgentNotificationTarget:
        inactiveAgentNotificationTarget ?? defaults.inactiveAgentNotificationTarget,
      authentication: {
        enabled: authEnabled === true && Boolean(authUsername && authPasswordHash),
        username: authUsername,
        passwordHash: authPasswordHash,
      },
    };
  } catch {
    return defaultUiServerSettings();
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
    notifyManagersOfInactiveAgents: settings.notifyManagersOfInactiveAgents,
    maxInactivityMinutes: settings.maxInactivityMinutes,
    inactiveAgentNotificationTarget: settings.inactiveAgentNotificationTarget,
    authentication,
    ceoBootstrapPending: options.ceoBootstrapPending ?? false,
  };
}
