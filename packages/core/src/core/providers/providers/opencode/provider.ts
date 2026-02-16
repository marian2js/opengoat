import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type {
  ProviderAuthOptions,
  ProviderExecutionResult,
  ProviderInvokeOptions,
} from "../../types.js";

export class OpenCodeProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "opencode",
      displayName: "OpenCode",
      kind: "cli",
      command: "opencode",
      commandEnvVar: "OPENCODE_CMD",
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
    _command: string,
  ): string[] {
    const message = options.message.trim();
    const model = options.model?.trim();
    const providerSessionId = options.providerSessionId?.trim();
    const passthrough = options.passthroughArgs ?? [];

    const args = ["run", "--format", "json"];

    if (providerSessionId) {
      args.push("--session", providerSessionId);
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
    _command: string,
  ): string[] {
    return ["auth", "login", ...(options.passthroughArgs ?? [])];
  }

  public override async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    const result = await super.invoke(options);
    const parsed = parseOpenCodeRunResponse(result.stdout);
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

export function parseOpenCodeRunResponse(raw: string): {
  assistantText?: string;
  providerSessionId?: string;
} | null {
  const records = parseJsonRecords(raw);
  if (records.length === 0) {
    return null;
  }

  const messageChunks: string[] = [];
  let providerSessionId: string | undefined;

  for (const record of records) {
    providerSessionId =
      readOptionalString(record.sessionID) ??
      readOptionalString(record.sessionId) ??
      readOptionalString(record.session_id) ??
      readOptionalString(asRecord(record.part).sessionID) ??
      readOptionalString(asRecord(record.part).sessionId) ??
      readOptionalString(asRecord(record.part).session_id) ??
      providerSessionId;

    const eventType = readOptionalString(record.type);
    if (eventType === "text") {
      const text =
        readOptionalString(asRecord(record.part).text) ??
        readOptionalString(record.text);
      if (text) {
        messageChunks.push(text);
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

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
