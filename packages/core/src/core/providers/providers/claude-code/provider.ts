import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type {
  ProviderAuthOptions,
  ProviderExecutionResult,
  ProviderInvocation,
  ProviderInvokeOptions,
} from "../../types.js";

export class ClaudeCodeProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "claude-code",
      displayName: "Claude Code",
      kind: "cli",
      command: "claude",
      commandEnvVar: "CLAUDE_CODE_CMD",
      capabilities: {
        agent: false,
        model: true,
        auth: true,
        passthrough: true,
        agentCreate: false,
        agentDelete: false,
      },
    });
  }

  public override buildInvocation(
    options: ProviderInvokeOptions,
    env: NodeJS.ProcessEnv = process.env,
  ): ProviderInvocation {
    this.validateInvokeOptions(options);
    const command = this.resolveCommand(env);
    const args = this.buildInvocationArgs(options, command);

    return { command, args };
  }

  protected buildInvocationArgs(options: ProviderInvokeOptions): string[] {
    const args = ["-p", options.message, "--output-format", "json"];

    const sessionId = options.providerSessionId?.trim();
    if (sessionId) {
      args.push("--resume", sessionId);
    }

    const model = options.model?.trim();
    if (model) {
      args.push("--model", model);
    }

    const systemPrompt = options.systemPrompt?.trim();
    if (systemPrompt) {
      args.push("--append-system-prompt", systemPrompt);
    }

    args.push(...(options.passthroughArgs ?? []));
    return args;
  }

  protected override buildAuthInvocationArgs(
    options: ProviderAuthOptions,
  ): string[] {
    return ["auth", "login", ...(options.passthroughArgs ?? [])];
  }

  public override async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    const result = await super.invoke(options);
    const parsed = parseClaudeCodeResponse(result.stdout);
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

export function parseClaudeCodeResponse(raw: string): {
  assistantText?: string;
  providerSessionId?: string;
} | null {
  const records = parseJsonRecords(raw);
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const entry = records[index];
    if (!entry) {
      continue;
    }

    const normalized = normalizeClaudeCodeRecord(entry);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeClaudeCodeRecord(record: Record<string, unknown>): {
  assistantText?: string;
  providerSessionId?: string;
} | null {
  const sessionId =
    readOptionalString(record.session_id) ??
    readOptionalString(record.sessionId) ??
    readOptionalString(asRecord(record.meta).session_id) ??
    readOptionalString(asRecord(record.meta).sessionId);

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
