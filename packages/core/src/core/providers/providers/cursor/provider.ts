import { basename } from "node:path";
import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type {
  ProviderAuthOptions,
  ProviderExecutionResult,
  ProviderInvokeOptions,
} from "../../types.js";

export class CursorProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "cursor",
      displayName: "Cursor",
      kind: "cli",
      command: "cursor",
      commandEnvVar: "CURSOR_CMD",
      capabilities: {
        agent: false,
        model: true,
        auth: true,
        passthrough: true,
        reportees: false,
        agentCreate: false,
        agentDelete: false,
      },
    });
  }

  protected override buildInvocationArgs(
    options: ProviderInvokeOptions,
    command: string,
  ): string[] {
    const message = options.message.trim();
    const model = options.model?.trim();
    const providerSessionId = options.providerSessionId?.trim();
    const passthrough = options.passthroughArgs ?? [];

    const args = [
      ...resolveCursorAgentPrefix(command),
      "--print",
      "--output-format",
      "json",
      "--force",
    ];

    if (providerSessionId) {
      args.push("--resume", providerSessionId);
    }

    if (model) {
      args.push("--model", model);
    }

    args.push(...passthrough);
    args.push(message);
    return args;
  }

  protected override buildAuthInvocationArgs(
    options: ProviderAuthOptions,
    command: string,
  ): string[] {
    return [
      ...resolveCursorAgentPrefix(command),
      "login",
      ...(options.passthroughArgs ?? []),
    ];
  }

  public override async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    const result = await super.invoke(options);
    const parsed = parseCursorAgentResponse(result.stdout);
    const normalizedStdout = parsed?.assistantText || result.stdout;

    return attachProviderSessionId(
      {
        ...result,
        stdout: normalizedStdout,
      },
      parsed?.providerSessionId,
    );
  }
}

function resolveCursorAgentPrefix(command: string): string[] {
  const commandName = basename(command).toLowerCase();
  if (commandName === "cursor-agent" || commandName === "agent") {
    return [];
  }

  return ["agent"];
}

export function parseCursorAgentResponse(raw: string): {
  assistantText?: string;
  providerSessionId?: string;
} | null {
  const records = parseJsonRecords(raw);
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const entry = records[index];
    if (!entry) {
      continue;
    }

    const normalized = normalizeCursorAgentRecord(entry);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeCursorAgentRecord(record: Record<string, unknown>): {
  assistantText?: string;
  providerSessionId?: string;
} | null {
  const sessionId =
    readOptionalString(record.session_id) ??
    readOptionalString(record.sessionId);

  const resultText =
    readOptionalString(record.result) ??
    readContentText(record.message) ??
    readContentText(record);

  if (!resultText && !sessionId) {
    return null;
  }

  return {
    assistantText: resultText,
    providerSessionId: sessionId,
  };
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

  return records;
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

function readContentText(value: unknown): string | undefined {
  const record = asRecord(value);
  const content = Array.isArray(record.content) ? record.content : [];
  const chunks: string[] = [];

  for (const item of content) {
    const entry = asRecord(item);
    const text =
      readOptionalString(entry.text) ??
      readOptionalString(entry.content) ??
      readOptionalString(asRecord(entry.message).text);
    if (text) {
      chunks.push(text);
    }
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return chunks.join("\n\n");
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
