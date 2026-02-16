import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type {
  ProviderAuthOptions,
  ProviderExecutionResult,
  ProviderInvokeOptions,
} from "../../types.js";

export class CodexProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "codex",
      displayName: "Codex",
      kind: "cli",
      command: "codex",
      commandEnvVar: "CODEX_CMD",
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

    if (providerSessionId) {
      const args = ["exec", "resume", "--json", "--skip-git-repo-check"];
      if (model) {
        args.push("--model", model);
      }
      args.push(...passthrough);
      args.push(providerSessionId, message);
      return args;
    }

    const args = ["exec", "--json", "--skip-git-repo-check"];
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
    return ["login", ...(options.passthroughArgs ?? [])];
  }

  public override async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    const result = await super.invoke(options);
    const parsed = parseCodexExecResponse(result.stdout);
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

export function parseCodexExecResponse(raw: string): {
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
    const eventType = readOptionalString(record.type);
    if (eventType === "thread.started") {
      providerSessionId =
        readOptionalString(record.thread_id) ??
        readOptionalString(record.threadId) ??
        providerSessionId;
      continue;
    }

    if (eventType === "item.completed") {
      const item = asRecord(record.item);
      const itemType = readOptionalString(item.type);
      if (itemType === "agent_message") {
        const text = readOptionalString(item.text) ?? readContentText(item);
        if (text) {
          messageChunks.push(text);
        }
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

function readContentText(value: unknown): string | undefined {
  const record = asRecord(value);
  const content = Array.isArray(record.content) ? record.content : [];
  const chunks: string[] = [];

  for (const entry of content) {
    const item = asRecord(entry);
    const text =
      readOptionalString(item.text) ??
      readOptionalString(item.content) ??
      readOptionalString(asRecord(item.message).text);
    if (text) {
      chunks.push(text);
    }
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return chunks.join("\n\n").trim() || undefined;
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
