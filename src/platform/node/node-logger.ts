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

  if (canRenderInline(next)) {
    const inline = Object.entries(next)
      .map(([key, value]) => `${key}=${renderInlineScalar(value)}`)
      .join(" ");
    return ` ${inline}`;
  }

  const lines = Object.entries(next).map(([key, value]) => renderContextField(key, value, 2));
  return `\n${lines.join("\n")}`;
}

function canRenderInline(context: Record<string, unknown>): boolean {
  return Object.values(context).every(isInlineScalar);
}

function isInlineScalar(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.length <= 80 && !value.includes("\n");
  }
  return typeof value === "number" || typeof value === "boolean" || typeof value === "bigint";
}

function renderInlineScalar(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return value.includes(" ") ? `"${value}"` : value;
  }
  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }
  return String(value);
}

function renderContextField(key: string, value: unknown, indent: number): string {
  const prefix = `${" ".repeat(indent)}${key}:`;
  if (value === undefined) {
    return `${prefix} undefined`;
  }
  if (value === null) {
    return `${prefix} null`;
  }
  if (typeof value === "string") {
    return renderStringField(prefix, value, indent);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return `${prefix} ${renderInlineScalar(value)}`;
  }

  const serialized = safeStringify(value);
  if (!serialized.includes("\n")) {
    return `${prefix} ${serialized}`;
  }

  const indented = serialized
    .split("\n")
    .map((line) => `${" ".repeat(indent + 2)}${line}`)
    .join("\n");
  return `${prefix}\n${indented}`;
}

function renderStringField(prefix: string, value: string, indent: number): string {
  if (!value.includes("\n")) {
    return `${prefix} ${value === "" ? '""' : value}`;
  }

  const body = value
    .split("\n")
    .map((line) => `${" ".repeat(indent + 2)}${line}`)
    .join("\n");
  return `${prefix} |\n${body}`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
