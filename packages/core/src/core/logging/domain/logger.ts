export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  readonly level: LogLevel;

  child(context: LogContext): Logger;
  isLevelEnabled(level: LogLevel): boolean;
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

export function normalizeLogLevel(raw?: string | null, fallback: LogLevel = "warn"): LogLevel {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === "silent" || normalized === "error" || normalized === "warn" || normalized === "info" || normalized === "debug") {
    return normalized;
  }
  return fallback;
}

export function isLogLevelEnabled(current: LogLevel, target: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[target] <= LOG_LEVEL_PRIORITY[current];
}

