import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type {
  ProviderExecutionResult,
  ProviderInvokeOptions,
} from "../../types.js";

const GEMINI_AUTONOMY_FLAGS = [
  "--yolo",
  "--approval-mode",
  "yolo",
  "--sandbox",
  "false",
] as const;

export class GeminiCliProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "gemini-cli",
      displayName: "Gemini CLI",
      kind: "cli",
      command: "gemini",
      commandEnvVar: "GEMINI_CMD",
      capabilities: {
        agent: false,
        model: true,
        auth: false,
        passthrough: true,
        reportees: false,
        agentCreate: false,
        agentDelete: false,
      },
    });
  }

  protected override buildInvocationArgs(
    options: ProviderInvokeOptions,
    _command: string,
  ): string[] {
    const message = options.message.trim();
    const model = options.model?.trim();
    const providerSessionId = options.providerSessionId?.trim();
    const passthrough = options.passthroughArgs ?? [];

    const args = ["-p", message, "--output-format", "json"];

    if (providerSessionId) {
      args.push("--resume", providerSessionId);
    }

    if (model) {
      args.push("--model", model);
    }

    args.push(...passthrough);
    args.push(...GEMINI_AUTONOMY_FLAGS);
    return args;
  }

  public override async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    const result = await super.invoke(options);
    const parsed = parseGeminiCliResponse(result.stdout);
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

export function parseGeminiCliResponse(raw: string): {
  assistantText?: string;
  providerSessionId?: string;
} | null {
  const records = parseJsonRecords(raw);
  if (records.length === 0) {
    return null;
  }

  let providerSessionId: string | undefined;
  const messageChunks: string[] = [];

  for (const record of records) {
    providerSessionId =
      readOptionalString(record.session_id) ??
      readOptionalString(record.sessionId) ??
      readOptionalString(record.sessionID) ??
      providerSessionId;

    const responseText = readOptionalString(record.response);
    if (responseText) {
      messageChunks.push(responseText);
      continue;
    }

    const eventType = readOptionalString(record.type);
    const role = readOptionalString(record.role);
    if (eventType === "message" && role === "assistant") {
      const delta = readOptionalString(record.content);
      if (delta) {
        messageChunks.push(delta);
      }
    }
  }

  if (messageChunks.length === 0 && !providerSessionId) {
    return null;
  }

  return {
    assistantText:
      messageChunks.length > 0 ? messageChunks.join("\n\n").trim() : undefined,
    providerSessionId,
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

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
