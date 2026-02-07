import type { LogContext, Logger, LogLevel } from "../domain/logger.js";
import { isLogLevelEnabled } from "../domain/logger.js";

export interface LogRecord {
  timestamp: string;
  level: Exclude<LogLevel, "silent">;
  message: string;
  context?: LogContext;
}

interface StructuredLoggerConfig {
  level: LogLevel;
  bindings?: LogContext;
  sink: (record: LogRecord) => void;
  nowIso?: () => string;
}

export class StructuredLogger implements Logger {
  public readonly level: LogLevel;
  private readonly bindings: LogContext;
  private readonly sink: (record: LogRecord) => void;
  private readonly nowIso: () => string;

  public constructor(config: StructuredLoggerConfig) {
    this.level = config.level;
    this.bindings = { ...(config.bindings ?? {}) };
    this.sink = config.sink;
    this.nowIso = config.nowIso ?? (() => new Date().toISOString());
  }

  public child(context: LogContext): Logger {
    return new StructuredLogger({
      level: this.level,
      sink: this.sink,
      nowIso: this.nowIso,
      bindings: {
        ...this.bindings,
        ...context
      }
    });
  }

  public isLevelEnabled(level: LogLevel): boolean {
    return isLogLevelEnabled(this.level, level);
  }

  public error(message: string, context?: LogContext): void {
    this.emit("error", message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.emit("warn", message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.emit("info", message, context);
  }

  public debug(message: string, context?: LogContext): void {
    this.emit("debug", message, context);
  }

  private emit(level: Exclude<LogLevel, "silent">, message: string, context?: LogContext): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const mergedContext = mergeContexts(this.bindings, context);
    this.sink({
      timestamp: this.nowIso(),
      level,
      message,
      context: Object.keys(mergedContext).length > 0 ? mergedContext : undefined
    });
  }
}

class NoopLogger implements Logger {
  public readonly level: LogLevel = "silent";

  public child(): Logger {
    return this;
  }

  public isLevelEnabled(): boolean {
    return false;
  }

  public error(): void {
    // noop
  }

  public warn(): void {
    // noop
  }

  public info(): void {
    // noop
  }

  public debug(): void {
    // noop
  }
}

const noopLogger = new NoopLogger();

export function createNoopLogger(): Logger {
  return noopLogger;
}

function mergeContexts(base: LogContext, next?: LogContext): LogContext {
  if (!next) {
    return { ...base };
  }

  return {
    ...base,
    ...next
  };
}

