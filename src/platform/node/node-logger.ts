import { StructuredLogger, createNoopLogger, normalizeLogLevel, type LogRecord } from "../../core/logging/index.js";
import type { LogLevel, Logger } from "../../core/logging/index.js";

type NodeLogFormat = "pretty" | "json";

export interface NodeLoggerConfig {
  level?: LogLevel;
  format?: NodeLogFormat;
  stream?: NodeJS.WritableStream;
}

export function createNodeLogger(config: NodeLoggerConfig = {}): Logger {
  const level = config.level ?? normalizeLogLevel(process.env.OPENGOAT_LOG_LEVEL, "warn");
  if (level === "silent") {
    return createNoopLogger();
  }

  const format = resolveLogFormat(config.format);
  const stream = config.stream ?? process.stderr;

  return new StructuredLogger({
    level,
    sink: (record) => {
      stream.write(renderRecord(record, format));
    }
  });
}

function resolveLogFormat(explicit?: NodeLogFormat): NodeLogFormat {
  if (explicit === "pretty" || explicit === "json") {
    return explicit;
  }
  const env = process.env.OPENGOAT_LOG_FORMAT?.trim().toLowerCase();
  if (env === "pretty" || env === "json") {
    return env;
  }
  return "pretty";
}

function renderRecord(record: LogRecord, format: NodeLogFormat): string {
  if (format === "json") {
    return `${JSON.stringify(record)}\n`;
  }

  const scope =
    typeof record.context?.scope === "string" && record.context.scope.trim().length > 0
      ? ` ${record.context.scope}`
      : "";
  const level = record.level.toUpperCase().padEnd(5, " ");
  const details = formatContext(record.context);
  return `[${record.timestamp}] ${level}${scope} ${record.message}${details}\n`;
}

function formatContext(context: Record<string, unknown> | undefined): string {
  if (!context) {
    return "";
  }

  const next = { ...context };
  delete next.scope;
  if (Object.keys(next).length === 0) {
    return "";
  }

  return ` ${JSON.stringify(next)}`;
}

