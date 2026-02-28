import { BaseCliProvider } from "../../cli-provider.js";
import { attachProviderSessionId } from "../../provider-session.js";
import type {
  ProviderAuthOptions,
  ProviderCreateAgentOptions,
  ProviderDeleteAgentOptions,
  ProviderExecutionResult,
  ProviderInvokeOptions,
} from "../../types.js";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";

export class OpenClawProvider extends BaseCliProvider {
  public constructor() {
    super({
      id: "openclaw",
      displayName: "OpenClaw",
      kind: "cli",
      command: "openclaw",
      commandEnvVar: "OPENCLAW_CMD",
      capabilities: {
        agent: true,
        model: true,
        auth: true,
        passthrough: true,
        reportees: true,
        agentCreate: true,
        agentDelete: true,
      },
    });
  }

  protected buildInvocationArgs(options: ProviderInvokeOptions): string[] {
    const runtime = resolveGatewayInvocationRuntime(options.env);
    const sessionKey = buildOpenClawSessionKey(options.agent, options.providerSessionId);
    const args = [...runtime.globalArgs, "gateway", "call", "agent"];

    if (runtime.gatewayUrl && runtime.gatewayToken) {
      args.push("--url", runtime.gatewayUrl, "--token", runtime.gatewayToken);
    }

    args.push(...(options.passthroughArgs ?? []));
    args.push(
      "--expect-final",
      "--json",
      "--timeout",
      "630000",
      "--params",
      JSON.stringify(buildGatewayAgentParams(options, sessionKey))
    );

    return args;
  }

  protected override prepareExecutionEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const preferredNodePaths = resolvePreferredCommandPaths(env);
    const mergedPath = dedupePathEntries([
      ...preferredNodePaths,
      ...(env.PATH?.split(delimiter) ?? []),
    ]);

    return {
      ...env,
      PATH: mergedPath.join(delimiter),
    };
  }

  protected override buildAuthInvocationArgs(
    options: ProviderAuthOptions,
  ): string[] {
    const passthrough = options.passthroughArgs ?? [];

    if (passthrough.length > 0) {
      return [
        ...resolveOpenClawArguments(options.env),
        "models",
        "auth",
        "login",
        ...passthrough,
      ];
    }

    return [...resolveOpenClawArguments(options.env), "onboard"];
  }

  protected override buildCreateAgentInvocationArgs(
    options: ProviderCreateAgentOptions,
  ): string[] {
    const args = [
      "agents",
      "add",
      options.agentId,
      "--workspace",
      options.workspaceDir,
      "--agent-dir",
      options.internalConfigDir,
      "--non-interactive",
    ];

    const model = options.env?.OPENGOAT_OPENCLAW_MODEL?.trim();
    if (model) {
      args.push("--model", model);
    }

    return [...resolveOpenClawArguments(options.env), ...args];
  }

  protected override buildDeleteAgentInvocationArgs(
    options: ProviderDeleteAgentOptions,
  ): string[] {
    return [
      ...resolveOpenClawArguments(options.env),
      "agents",
      "delete",
      options.agentId,
      "--force",
    ];
  }

  public override async invoke(
    options: ProviderInvokeOptions,
  ): Promise<ProviderExecutionResult> {
    const sessionKey = buildOpenClawSessionKey(options.agent, options.providerSessionId);
    const result = await super.invoke(options);
    const parsed = parseGatewayAgentResponse(result.stdout);
    const normalizedStdout = parsed?.assistantText || result.stdout;
    return attachProviderSessionId(
      {
        ...result,
        stdout: normalizedStdout,
      },
      sessionKey ?? parsed?.providerSessionId
    );
  }
}

function buildOpenClawSessionKey(
  agentId: string | undefined,
  providerSessionId: string | undefined
): string | undefined {
  const raw = providerSessionId?.trim();
  if (!raw) {
    return undefined;
  }
  if (raw.includes(":")) {
    return raw.toLowerCase();
  }
  return `agent:${normalizeSessionSegment(agentId) || "main"}:${normalizeSessionSegment(raw) || "main"}`;
}

function buildGatewayAgentParams(
  options: ProviderInvokeOptions,
  sessionKey: string | undefined
): Record<string, unknown> {
  const idempotencyKey = options.idempotencyKey?.trim() || randomUUID().toLowerCase();
  const params: Record<string, unknown> = {
    message: options.message,
    idempotencyKey,
  };

  const agentId = options.agent?.trim();
  if (agentId) {
    params.agentId = agentId;
  }

  const model = options.model?.trim();
  if (model) {
    params.model = model;
  }

  const providerSessionId = options.providerSessionId?.trim();
  if (providerSessionId) {
    params.sessionId = providerSessionId;
  }

  if (sessionKey) {
    params.sessionKey = sessionKey;
  }

  return params;
}

function resolveOpenClawArguments(env: NodeJS.ProcessEnv | undefined): string[] {
  const raw = env?.OPENCLAW_ARGUMENTS?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function resolveGatewayInvocationRuntime(env: NodeJS.ProcessEnv | undefined): {
  globalArgs: string[];
  gatewayUrl?: string;
  gatewayToken?: string;
} {
  const parsed = tokenizeArguments(env?.OPENCLAW_ARGUMENTS);
  let gatewayUrl = env?.OPENCLAW_GATEWAY_URL?.trim();
  let gatewayToken = env?.OPENCLAW_GATEWAY_PASSWORD?.trim();
  const globalArgs: string[] = [];

  for (let index = 0; index < parsed.length; index += 1) {
    const token = parsed[index]?.trim();
    if (!token) {
      continue;
    }

    if (token === "--remote") {
      const next = parsed[index + 1]?.trim();
      if (next && !next.startsWith("--")) {
        if (!gatewayUrl) {
          gatewayUrl = next;
        }
        index += 1;
      }
      continue;
    }

    if (token === "--token") {
      const next = parsed[index + 1]?.trim();
      if (next && !next.startsWith("--")) {
        if (!gatewayToken) {
          gatewayToken = next;
        }
        index += 1;
      }
      continue;
    }

    globalArgs.push(token);
  }

  return {
    globalArgs,
    gatewayUrl,
    gatewayToken,
  };
}

function tokenizeArguments(raw: string | undefined): string[] {
  const value = raw?.trim();
  if (!value) {
    return [];
  }
  return value
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function normalizeSessionSegment(value: string | undefined): string {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized;
}

export function parseGatewayAgentResponse(raw: string): {
  assistantText: string;
  providerSessionId?: string;
} | null {
  const records = parseJsonRecords(raw);
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record) {
      continue;
    }
    const normalized = normalizeGatewayAgentRecord(record);
    if (normalized?.assistantText) {
      return normalized;
    }
  }

  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record) {
      continue;
    }
    const normalized = normalizeGatewayAgentRecord(record);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeGatewayAgentRecord(record: Record<string, unknown>): {
  assistantText: string;
  providerSessionId?: string;
} | null {
  const result = asRecord(record.result);
  const payloads = Array.isArray(result.payloads)
    ? result.payloads
    : Array.isArray(record.payloads)
      ? record.payloads
      : [];

  const lines: string[] = [];
  for (const payload of payloads) {
    const payloadRecord = asRecord(payload);
    const text =
      readOptionalString(payloadRecord.text) ??
      readOptionalString(payloadRecord.content) ??
      readOptionalString(payloadRecord.message);
    if (text) {
      lines.push(text.trim());
    }
    for (const mediaUrl of normalizeMediaUrls(
      payloadRecord.mediaUrl,
      payloadRecord.mediaUrls,
    )) {
      lines.push(`MEDIA:${mediaUrl}`);
    }
  }

  const assistantText = lines.join("\n\n").trim();
  const providerSessionId =
    readOptionalString(asRecord(asRecord(result.meta).agentMeta).sessionId) ??
    readOptionalString(asRecord(asRecord(record.meta).agentMeta).sessionId);

  if (!assistantText && !providerSessionId) {
    return null;
  }

  return {
    assistantText,
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
  if (records.length > 0) {
    return records;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const extracted = trimmed.slice(firstBrace, lastBrace + 1);
    const parsed = parseJsonRecord(extracted);
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

function normalizeMediaUrls(mediaUrl: unknown, mediaUrls: unknown): string[] {
  const urls: string[] = [];
  if (typeof mediaUrl === "string") {
    const normalized = mediaUrl.trim();
    if (normalized) {
      urls.push(normalized);
    }
  }

  if (!Array.isArray(mediaUrls)) {
    return urls;
  }

  for (const entry of mediaUrls) {
    if (typeof entry !== "string") {
      continue;
    }
    const normalized = entry.trim();
    if (normalized) {
      urls.push(normalized);
    }
  }

  return urls;
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

function resolvePreferredCommandPaths(env: NodeJS.ProcessEnv): string[] {
  const homeDir = homedir();
  const preferredPaths: string[] = [
    dirname(process.execPath),
    join(homeDir, ".npm-global", "bin"),
    join(homeDir, ".npm", "bin"),
    join(homeDir, ".local", "bin"),
    join(homeDir, ".volta", "bin"),
    join(homeDir, ".fnm", "current", "bin"),
    join(homeDir, ".asdf", "shims"),
    join(homeDir, "bin"),
  ];

  const npmPrefixCandidates = dedupePathEntries([
    env.npm_config_prefix ?? "",
    env.NPM_CONFIG_PREFIX ?? "",
    process.env.npm_config_prefix ?? "",
    process.env.NPM_CONFIG_PREFIX ?? "",
  ]);
  for (const prefix of npmPrefixCandidates) {
    preferredPaths.push(join(prefix, "bin"));
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
