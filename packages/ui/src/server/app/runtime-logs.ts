import { execFile } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  OpenClawGatewayLogTail,
  OpenClawUiService,
  RuntimeLogExtractionOptions,
  RuntimeLogExtractionResult,
  UiLogLevel,
} from "./types.js";
import {
  sanitizeRuntimeProgressChunk,
  truncateProgressLine,
} from "./text.js";

const execFileAsync = promisify(execFile);

interface ParsedRuntimeLogLine {
  message: string;
  runId?: string;
  logLevel: string;
  timestampMs?: number;
}

export async function fetchOpenClawGatewayLogTail(
  service: OpenClawUiService,
  params: {
    cursor?: number;
    limit: number;
    maxBytes: number;
  },
): Promise<OpenClawGatewayLogTail> {
  if (typeof service.getOpenClawGatewayConfig !== "function") {
    throw new Error("Gateway config lookup is unavailable.");
  }

  const gatewayConfig = await service.getOpenClawGatewayConfig();
  const args = [
    "gateway",
    "call",
    "logs.tail",
    "--json",
    "--timeout",
    "5000",
    "--params",
    JSON.stringify({
      ...(typeof params.cursor === "number" ? { cursor: params.cursor } : {}),
      limit: params.limit,
      maxBytes: params.maxBytes,
    }),
  ];

  if (
    gatewayConfig.mode === "external" &&
    gatewayConfig.gatewayUrl?.trim() &&
    gatewayConfig.gatewayToken?.trim()
  ) {
    args.push(
      "--url",
      gatewayConfig.gatewayUrl.trim(),
      "--token",
      gatewayConfig.gatewayToken.trim(),
    );
  }

  const command =
    gatewayConfig.command?.trim() || process.env.OPENCLAW_CMD?.trim() || "openclaw";
  const env = buildOpenClawExecutionEnv(process.env);
  const { stdout } = await execFileAsync(command, args, {
    timeout: 6000,
    env,
  });
  const parsed = parseCommandJson(stdout);
  const payload = resolveCommandPayload(parsed);
  const cursorValue =
    typeof payload?.cursor === "number" && Number.isFinite(payload.cursor)
      ? payload.cursor
      : 0;
  const lines = Array.isArray(payload?.lines)
    ? payload.lines.filter((entry): entry is string => typeof entry === "string")
    : [];
  const reset = payload?.reset === true;

  return {
    cursor: cursorValue,
    lines,
    reset,
  };
}

function resolveCommandPayload(
  parsed: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!parsed) {
    return null;
  }

  const result = parsed.result;
  if (result && typeof result === "object") {
    return result as Record<string, unknown>;
  }

  return parsed;
}

export function parseCommandJson(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line?.startsWith("{") || !line.endsWith("}")) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // keep scanning
    }
  }

  return null;
}

export function resolveUiLogMessageFromGatewayLine(
  parsed: Record<string, unknown> | null,
  fallbackLine: string,
): string | null {
  if (!parsed) {
    const cleaned = sanitizeRuntimeProgressChunk(fallbackLine);
    return cleaned || null;
  }

  const preferredCandidates = [parsed["1"], parsed.message, parsed["0"]];
  for (const candidate of preferredCandidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const cleaned = sanitizeRuntimeProgressChunk(candidate);
    if (cleaned) {
      return cleaned;
    }
  }

  const serialized = sanitizeRuntimeProgressChunk(JSON.stringify(parsed));
  return serialized || null;
}

export function resolveUiLogTimestamp(
  parsed: Record<string, unknown> | null,
): string {
  const timeRaw = parsed?.time;
  if (typeof timeRaw === "string" && Number.isFinite(Date.parse(timeRaw))) {
    return new Date(timeRaw).toISOString();
  }
  return new Date().toISOString();
}

export function resolveUiLogLevel(
  parsed: Record<string, unknown> | null,
): UiLogLevel {
  const meta = parsed?._meta;
  const levelFromMeta =
    meta &&
    typeof meta === "object" &&
    typeof (meta as Record<string, unknown>).logLevelName === "string"
      ? (meta as Record<string, unknown>).logLevelName
      : undefined;
  const levelText =
    typeof levelFromMeta === "string"
      ? levelFromMeta
      : typeof parsed?.level === "string"
        ? parsed.level
        : "";
  const normalized = levelText.trim().toLowerCase();
  if (normalized === "error" || normalized === "fatal") {
    return "error";
  }
  if (normalized === "warn" || normalized === "warning") {
    return "warn";
  }
  return "info";
}

export function extractRuntimeActivityFromLogLines(
  lines: string[],
  options: RuntimeLogExtractionOptions,
): RuntimeLogExtractionResult {
  const primaryRunId = options.primaryRunId.trim();
  if (!primaryRunId) {
    return {
      activities: [],
    };
  }

  const fallbackRunId = options.fallbackRunId?.trim();
  const activities: Array<{ level: "stdout" | "stderr"; message: string }> = [];
  let nextFallbackRunId: string | undefined;

  for (const line of lines) {
    const parsed = parseRuntimeLogLine(line);
    if (!parsed) {
      continue;
    }

    const matchesPrimaryRun =
      parsed.runId === primaryRunId || parsed.message.includes(primaryRunId);
    const boundFallbackRunId = fallbackRunId || nextFallbackRunId;
    const matchesFallbackRun = Boolean(
      boundFallbackRunId &&
        (parsed.runId === boundFallbackRunId ||
          parsed.message.includes(boundFallbackRunId)),
    );

    const activeFallback = boundFallbackRunId;
    const shouldAdoptFallback =
      !matchesPrimaryRun &&
      !matchesFallbackRun &&
      !activeFallback &&
      isEmbeddedRunStartMessage(parsed.message) &&
      Boolean(parsed.runId) &&
      isRecentRuntimeLog(parsed.timestampMs, options.startedAtMs);

    if (shouldAdoptFallback) {
      nextFallbackRunId = parsed.runId;
    }

    const matchesRun =
      matchesPrimaryRun || matchesFallbackRun || shouldAdoptFallback;
    const hasBoundRun =
      matchesPrimaryRun ||
      matchesFallbackRun ||
      Boolean(activeFallback) ||
      shouldAdoptFallback;
    const isToolFailure = parsed.message.toLowerCase().includes("[tools]");
    if (!matchesRun) {
      if (
        !isToolFailure ||
        !isRecentRuntimeLog(parsed.timestampMs, options.startedAtMs)
      ) {
        continue;
      }
      if (!hasBoundRun) {
        continue;
      }
    }

    if (!isRuntimeRelevantMessage(parsed.message)) {
      continue;
    }

    const normalizedMessage = normalizeRuntimeLogMessage(parsed.message, [
      primaryRunId,
      fallbackRunId,
      nextFallbackRunId,
    ]);
    const userFacingMessage = toUserFacingRuntimeMessage(normalizedMessage);
    if (!userFacingMessage) {
      continue;
    }

    activities.push({
      level: resolveRuntimeLogLevel(parsed.logLevel, normalizedMessage),
      message: truncateProgressLine(userFacingMessage),
    });
  }

  return {
    activities,
    nextFallbackRunId,
  };
}

function parseRuntimeLogLine(line: string): ParsedRuntimeLogLine | null {
  const parsed = parseCommandJson(line);
  if (!parsed) {
    return null;
  }

  const message = selectRuntimeLogMessage(parsed);
  if (!message) {
    return null;
  }

  const normalizedMessage = sanitizeRuntimeProgressChunk(
    message.replace(/\s+/g, " "),
  );
  if (!normalizedMessage) {
    return null;
  }

  const meta = parsed._meta;
  const metaRecord =
    meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
  const logLevel =
    typeof metaRecord?.logLevelName === "string"
      ? metaRecord.logLevelName.toLowerCase()
      : "";
  const timeRaw = typeof parsed.time === "string" ? parsed.time : undefined;
  const timestampMs =
    typeof timeRaw === "string" && Number.isFinite(Date.parse(timeRaw))
      ? Date.parse(timeRaw)
      : undefined;

  return {
    message: normalizedMessage,
    runId: extractRunIdFromMessage(normalizedMessage),
    logLevel,
    timestampMs,
  };
}

function selectRuntimeLogMessage(parsed: Record<string, unknown>): string | null {
  const primaryCandidates = [parsed["1"], parsed.message];
  for (const candidate of primaryCandidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    if (isRuntimeRelevantMessage(candidate)) {
      return candidate;
    }
  }

  const fallbackCandidate = parsed["0"];
  if (
    typeof fallbackCandidate === "string" &&
    isRuntimeRelevantMessage(fallbackCandidate)
  ) {
    return fallbackCandidate;
  }

  return null;
}

function isRuntimeRelevantMessage(message: string): boolean {
  return /embedded run|session state|lane task|\[tools\]|tool start|tool end|tool failed|prompt start|prompt end|agent start|agent end|run done|aborted/i.test(
    message,
  );
}

function isEmbeddedRunStartMessage(message: string): boolean {
  return /embedded run start/i.test(message);
}

function extractRunIdFromMessage(message: string): string | undefined {
  const equalsMatch = message.match(/\brunId=([^\s]+)/i);
  if (equalsMatch?.[1]) {
    return equalsMatch[1];
  }

  const jsonMatch = message.match(/"runId"\s*:\s*"([^"]+)"/i);
  if (jsonMatch?.[1]) {
    return jsonMatch[1];
  }

  return undefined;
}

function isRecentRuntimeLog(
  timestampMs: number | undefined,
  runStartedAtMs: number,
): boolean {
  if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs)) {
    return false;
  }
  return timestampMs >= runStartedAtMs - 2_000;
}

function normalizeRuntimeLogMessage(
  message: string,
  runIds: Array<string | undefined>,
): string {
  let normalized = sanitizeRuntimeProgressChunk(message.replace(/\s+/g, " "));
  for (const runId of runIds) {
    const value = runId?.trim();
    if (!value) {
      continue;
    }
    normalized = sanitizeRuntimeProgressChunk(
      normalized.replace(
        new RegExp(`\\brunId=${escapeRegExp(value)}\\b\\s*`, "g"),
        "",
      ),
    );
  }
  normalized = sanitizeRuntimeProgressChunk(
    normalized.replace(/^\{\s*"?subsystem"?\s*:\s*"[^"]+"\s*\}\s*/i, ""),
  );
  return normalized;
}

function toUserFacingRuntimeMessage(message: string): string | null {
  const normalized = message.trim();
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const toolName = extractTokenFromMessage(normalized, "tool");
  const durationMs = extractTokenFromMessage(normalized, "durationMs");

  if (lower.includes("embedded run start")) {
    return "Run accepted by OpenClaw.";
  }
  if (lower.includes("embedded run prompt start")) {
    return "Preparing prompt and context.";
  }
  if (lower.includes("embedded run agent start")) {
    return "Agent is reasoning.";
  }
  if (lower.includes("embedded run tool start")) {
    return toolName ? `Running tool: ${toolName}.` : "Running a tool.";
  }
  if (lower.includes("embedded run tool end")) {
    if (toolName && durationMs) {
      return `Finished tool: ${toolName} (${durationMs} ms).`;
    }
    return toolName ? `Finished tool: ${toolName}.` : "Finished tool run.";
  }
  if (lower.includes("[tools]") && lower.includes("failed")) {
    return toolName
      ? `Tool failed: ${toolName}.`
      : "A tool failed during execution.";
  }
  if (lower.includes("embedded run agent end")) {
    return "Agent finished reasoning.";
  }
  if (lower.includes("embedded run prompt end")) {
    return "Prompt execution completed.";
  }
  if (lower.includes("embedded run done")) {
    if (lower.includes("aborted=true")) {
      return "Run was aborted by the runtime.";
    }
    return "OpenClaw marked the run as done.";
  }
  if (lower.includes("session state")) {
    return "Updating session state.";
  }
  if (lower.includes("lane task")) {
    return "Processing task step.";
  }

  return normalized;
}

function extractTokenFromMessage(
  message: string,
  tokenName: string,
): string | undefined {
  const match = message.match(
    new RegExp(`\\b${escapeRegExp(tokenName)}=([^\\s]+)`, "i"),
  );
  return match?.[1];
}

function resolveRuntimeLogLevel(
  logLevel: string,
  message: string,
): "stdout" | "stderr" {
  const lower = message.toLowerCase();
  if (
    logLevel === "warn" ||
    logLevel === "error" ||
    lower.includes(" failed") ||
    lower.includes(" error") ||
    lower.includes("aborted=true")
  ) {
    return "stderr";
  }
  return "stdout";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildOpenClawExecutionEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const preferredNodePaths = resolvePreferredOpenClawCommandPaths(baseEnv);
  const existingPathEntries = (baseEnv.PATH ?? "").split(path.delimiter);
  const mergedPath = dedupePathEntries([...preferredNodePaths, ...existingPathEntries]);

  return {
    ...baseEnv,
    PATH: mergedPath.join(path.delimiter),
  };
}

function dedupePathEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    result.push(entry);
  }

  return result;
}

function resolvePreferredOpenClawCommandPaths(env: NodeJS.ProcessEnv): string[] {
  const preferredPaths: string[] = [
    path.dirname(process.execPath),
    path.join(homedir(), ".npm-global", "bin"),
    path.join(homedir(), ".npm", "bin"),
    path.join(homedir(), ".local", "bin"),
    path.join(homedir(), ".volta", "bin"),
    path.join(homedir(), ".fnm", "current", "bin"),
    path.join(homedir(), ".asdf", "shims"),
    path.join(homedir(), "bin"),
  ];

  const npmPrefixCandidates = dedupePathEntries([
    env.npm_config_prefix ?? "",
    env.NPM_CONFIG_PREFIX ?? "",
    process.env.npm_config_prefix ?? "",
    process.env.NPM_CONFIG_PREFIX ?? "",
  ]);
  for (const prefix of npmPrefixCandidates) {
    preferredPaths.push(path.join(prefix, "bin"));
  }

  if (process.platform === "darwin") {
    preferredPaths.push(
      "/opt/homebrew/bin",
      "/opt/homebrew/opt/node@22/bin",
      "/usr/local/opt/node@22/bin",
    );
  }

  return preferredPaths;
}
