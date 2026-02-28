import { DEFAULT_AGENT_ID } from "./constants.js";
import type {
  SessionMessageProgressPhase,
  UiRunEvent,
} from "./types.js";

export function stripQueryStringFromUrl(url: string): string {
  const separatorIndex = url.indexOf("?");
  if (separatorIndex < 0) {
    return url;
  }
  return url.slice(0, separatorIndex);
}

export function sanitizeConversationText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const withoutAnsi = stripAnsiCodes(trimmed)
    .replace(/\[(?:\d{1,3};)*\d{1,3}m/g, "")
    .replace(/(?:^|\s)(?:\d{1,3};)*\d{1,3}m(?=\s|$)/g, " ")
    .replace(/\r\n?/g, "\n");
  const withoutOpenClawStaleWarnings =
    stripOpenClawStalePluginWarnings(withoutAnsi);

  const withoutPrefix = withoutOpenClawStaleWarnings
    .replace(/^\s*\[agents\/[^\]\n]+\]\s*/iu, "")
    .replace(/^\s*inherited\s+[^\n]*?\s+from\s+main\s+agent\s*/iu, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return withoutPrefix;
}

export function extractAssistantTextFromStructuredOutput(
  value: string,
): string | undefined {
  const records = parseJsonRecords(value);
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record) {
      continue;
    }
    const parsed = parseStructuredOutputRecord(record);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

export function stripAnsiCodes(value: string): string {
  return value.replace(
    /[\u001B\u009B][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-ntqry=><]/g,
    "",
  );
}

export function sanitizeRuntimeProgressChunk(value: string): string {
  const withoutAnsi = stripAnsiCodes(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n");
  return stripOpenClawStalePluginWarnings(withoutAnsi).trim();
}

export function truncateProgressLine(value: string): string {
  const maxLength = 260;
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

export function formatUiLogMessagePreview(
  value: string,
  maxLength = 220,
): string {
  const cleaned = sanitizeConversationText(value).replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return `${cleaned.slice(0, maxLength - 1)}…`;
}

export function formatUiLogQuotedPreview(
  value: string,
  maxLength = 220,
): string {
  return formatUiLogMessagePreview(value, maxLength).replace(/"/g, "'");
}

export function mapRunStageToProgressPhase(
  stage: UiRunEvent["stage"],
): SessionMessageProgressPhase {
  switch (stage) {
    case "run_started":
      return "run_started";
    case "provider_invocation_started":
      return "provider_invocation_started";
    case "provider_invocation_completed":
      return "provider_invocation_completed";
    case "run_completed":
      return "run_completed";
    default:
      return "stdout";
  }
}

export function formatRunStatusMessage(event: UiRunEvent): string {
  switch (event.stage) {
    case "run_started":
      return `Starting @${event.agentId ?? DEFAULT_AGENT_ID}.`;
    case "provider_invocation_started":
      return `Sending request to ${formatProviderDisplayName(event.providerId)}.`;
    case "provider_invocation_completed":
      return typeof event.code === "number" && event.code !== 0
        ? `Provider finished with code ${event.code}.`
        : "Provider returned a response.";
    case "run_completed":
      return "Run completed.";
    default:
      return "Runtime update.";
  }
}

function formatProviderDisplayName(providerId: string | undefined): string {
  const normalizedProviderId = providerId?.trim().toLowerCase();
  if (!normalizedProviderId) {
    return "provider";
  }

  const knownDisplayName = KNOWN_PROVIDER_DISPLAY_NAMES[normalizedProviderId];
  if (knownDisplayName) {
    return knownDisplayName;
  }

  return normalizedProviderId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
}

const KNOWN_PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  "gemini-cli": "Gemini CLI",
  opencode: "OpenCode",
  openclaw: "OpenClaw",
};

function parseStructuredOutputRecord(record: Record<string, unknown>): string | undefined {
  const resultRecord = asRecord(record.result);
  const payloadCandidates: unknown[] = [];

  if (Array.isArray(resultRecord.payloads)) {
    payloadCandidates.push(...resultRecord.payloads);
  }
  if (Array.isArray(record.payloads)) {
    payloadCandidates.push(...record.payloads);
  }

  const textChunks: string[] = [];
  for (const payload of payloadCandidates) {
    const payloadRecord = asRecord(payload);
    const text =
      readOptionalString(payloadRecord.text) ??
      readOptionalString(payloadRecord.content) ??
      readOptionalString(payloadRecord.message);
    if (text) {
      textChunks.push(text);
    }
  }

  if (textChunks.length > 0) {
    return textChunks.join("\n\n").trim() || undefined;
  }

  const directText =
    readOptionalString(resultRecord.text) ??
    readOptionalString(resultRecord.result) ??
    readOptionalString(record.result) ??
    readOptionalString(record.text);
  return directText?.trim() || undefined;
}

function stripOpenClawStalePluginWarnings(value: string): string {
  const withoutLeadingWarningBlock = removeLeadingOpenClawWarningBlock(value);
  const lines = withoutLeadingWarningBlock.split("\n");
  const filtered = lines.filter((line) => {
    const normalized = normalizeOpenClawWarningLine(line);
    if (!normalized) {
      return true;
    }
    if (isOpenClawDecorativeWarningLine(normalized)) {
      return false;
    }
    return !isOpenClawStalePluginWarningLine(normalized);
  });

  return filtered
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function removeLeadingOpenClawWarningBlock(value: string): string {
  const lines = value.split("\n");
  let index = 0;

  while (
    index < lines.length &&
    !normalizeOpenClawWarningLine(lines[index] ?? "")
  ) {
    index += 1;
  }
  if (index >= lines.length) {
    return value;
  }

  const firstMeaningful = normalizeOpenClawWarningLine(lines[index] ?? "");
  if (!firstMeaningful.includes("config warnings")) {
    return value;
  }

  let cursor = index;
  while (cursor < lines.length) {
    const raw = lines[cursor] ?? "";
    const normalized = normalizeOpenClawWarningLine(raw);
    if (!normalized) {
      cursor += 1;
      continue;
    }
    if (isOpenClawWarningBlockLine(raw, normalized)) {
      cursor += 1;
      continue;
    }
    break;
  }

  const remaining = lines.slice(cursor).join("\n").trim();
  return remaining;
}

function normalizeOpenClawWarningLine(line: string): string {
  return stripAnsiCodes(line)
    .replace(/[|│┃║]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .toLowerCase();
}

function isOpenClawDecorativeWarningLine(line: string): boolean {
  return /^[┌┐└┘├┤┬┴┼─━═\-\s]+$/u.test(line);
}

function isOpenClawStalePluginWarningLine(line: string): boolean {
  if (line.includes("config warnings")) {
    return true;
  }
  if (line.includes("stale config entry ignored")) {
    return true;
  }
  if (line.includes("remove it from plugins config")) {
    return true;
  }
  return line.includes("plugins.entries.") && line.includes("plugin not found");
}

function isOpenClawWarningBlockLine(raw: string, normalized: string): boolean {
  if (isOpenClawDecorativeWarningLine(raw)) {
    return true;
  }
  if (/[│┃║┌┐└┘├┤┬┴┼╭╮╰╯]/u.test(raw)) {
    return true;
  }
  if (isOpenClawStalePluginWarningLine(normalized)) {
    return true;
  }
  if (normalized.startsWith("- ")) {
    return true;
  }
  if (normalized.includes("plugins config")) {
    return true;
  }
  if (normalized.includes("plugin not found")) {
    return true;
  }
  return false;
}

function parseJsonRecords(raw: string): Record<string, unknown>[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  const direct = parseJsonRecord(trimmed);
  if (direct) {
    return [direct];
  }

  const records: Record<string, unknown>[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const parsed = parseJsonRecord(line.trim());
    if (parsed) {
      records.push(parsed);
    }
  }
  if (records.length > 0) {
    return records;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const parsed = parseJsonRecord(trimmed.slice(firstBrace, lastBrace + 1));
    if (parsed) {
      return [parsed];
    }
  }

  return [];
}

function parseJsonRecord(raw: string): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
