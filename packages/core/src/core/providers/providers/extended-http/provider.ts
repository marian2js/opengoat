import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
  type Message
} from "@aws-sdk/client-bedrock-runtime";
import { BaseProvider } from "../../base-provider.js";
import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError
} from "../../errors.js";
import type {
  ProviderExecutionResult,
  ProviderInvokeOptions
} from "../../types.js";
import type {
  ExtendedHttpAuthHeader,
  ExtendedHttpProviderSpec
} from "./catalog.js";

interface ExtendedHttpProviderDeps {
  fetchFn?: typeof fetch;
  createBedrockClient?: (region: string) => { send: (command: ConverseCommand) => Promise<ConverseCommandOutput> };
}

interface ResolvedCredential {
  value: string;
  envVar: string;
}

export class ExtendedHttpProvider extends BaseProvider {
  private readonly spec: ExtendedHttpProviderSpec;
  private readonly fetchFn: typeof fetch;
  private readonly createBedrockClient: (
    region: string
  ) => { send: (command: ConverseCommand) => Promise<ConverseCommandOutput> };

  public constructor(spec: ExtendedHttpProviderSpec, deps: ExtendedHttpProviderDeps = {}) {
    super({
      id: spec.id,
      displayName: spec.displayName,
      kind: "http",
      capabilities: {
        agent: false,
        model: true,
        auth: false,
        passthrough: false
      }
    });
    this.spec = spec;
    this.fetchFn = deps.fetchFn ?? fetch;
    this.createBedrockClient =
      deps.createBedrockClient ??
      ((region: string) =>
        new BedrockRuntimeClient({
          region
        }));
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);

    const env = options.env ?? process.env;

    if (this.spec.protocol === "bedrock-converse") {
      return this.invokeBedrock(options, env);
    }

    if (this.spec.protocol === "anthropic-messages") {
      return this.invokeAnthropic(options, env);
    }

    return this.invokeOpenAiChat(options, env);
  }

  public override invokeAuth(): Promise<ProviderExecutionResult> {
    throw new UnsupportedProviderActionError(this.id, "auth");
  }

  private async invokeOpenAiChat(
    options: ProviderInvokeOptions,
    env: NodeJS.ProcessEnv
  ): Promise<ProviderExecutionResult> {
    const endpoint = this.resolveEndpoint(env, "/chat/completions");
    if (!endpoint) {
      return {
        code: 1,
        stdout: "",
        stderr: `Missing endpoint for ${this.id}. Configure ${this.describeEndpointEnvHints()}\n`
      };
    }

    const model = this.resolveModel(options, env);
    if (!model) {
      return {
        code: 1,
        stdout: "",
        stderr: `Missing model for ${this.id}. Set ${this.spec.modelEnvVar} or pass --model.\n`
      };
    }

    const credential = this.resolveCredential(env);
    const headers = this.buildHeaders(env, credential, "application/json");

    const payload = {
      model,
      messages: buildChatMessages(options),
      stream: false
    };

    return this.invokeJsonEndpoint({
      endpoint,
      payload,
      options,
      parseText: extractOpenAiLikeText,
      parseSessionId: (value) => extractStringValue((value as { id?: unknown }).id),
      headers
    });
  }

  private async invokeAnthropic(
    options: ProviderInvokeOptions,
    env: NodeJS.ProcessEnv
  ): Promise<ProviderExecutionResult> {
    const endpoint = this.resolveEndpoint(env, "/v1/messages");
    if (!endpoint) {
      return {
        code: 1,
        stdout: "",
        stderr: `Missing endpoint for ${this.id}. Configure ${this.describeEndpointEnvHints()}\n`
      };
    }

    const model = this.resolveModel(options, env);
    if (!model) {
      return {
        code: 1,
        stdout: "",
        stderr: `Missing model for ${this.id}. Set ${this.spec.modelEnvVar} or pass --model.\n`
      };
    }

    const credential = this.resolveCredential(env);
    const headers = this.buildHeaders(env, credential, "application/json");

    const maxTokens = resolvePositiveInteger(env[this.spec.maxTokensEnvVar ?? ""]?.trim()) ?? this.spec.defaultMaxTokens ?? 4096;

    const payload = {
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: options.message
            }
          ]
        }
      ],
      ...(options.systemPrompt?.trim() ? { system: options.systemPrompt.trim() } : {})
    };

    return this.invokeJsonEndpoint({
      endpoint,
      payload,
      options,
      parseText: extractAnthropicText,
      parseSessionId: (value) => extractStringValue((value as { id?: unknown }).id),
      headers
    });
  }

  private async invokeBedrock(
    options: ProviderInvokeOptions,
    env: NodeJS.ProcessEnv
  ): Promise<ProviderExecutionResult> {
    const model = this.resolveModel(options, env);
    if (!model) {
      return {
        code: 1,
        stdout: "",
        stderr: `Missing model for ${this.id}. Set ${this.spec.modelEnvVar} or pass --model.\n`
      };
    }

    const region = env.AWS_REGION?.trim() || env.AWS_DEFAULT_REGION?.trim() || "us-east-1";
    const client = this.createBedrockClient(region);

    const messages: Message[] = [
      {
        role: "user",
        content: [{ text: options.message }]
      }
    ];

    const command = new ConverseCommand({
      modelId: model,
      messages,
      ...(options.systemPrompt?.trim()
        ? {
            system: [
              {
                text: options.systemPrompt.trim()
              }
            ]
          }
        : {})
    });

    try {
      const response = await client.send(command);
      const text = extractBedrockText(response);
      if (!text) {
        throw new ProviderRuntimeError(this.id, "no textual output found in Bedrock response");
      }

      const normalized = ensureTrailingNewline(text);
      options.onStdout?.(normalized);
      return {
        code: 0,
        stdout: normalized,
        stderr: "",
        providerSessionId: extractStringValue(response.$metadata?.requestId) ?? undefined
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        code: 1,
        stdout: "",
        stderr: ensureTrailingNewline(`Bedrock request failed: ${message}`)
      };
    }
  }

  private resolveModel(options: ProviderInvokeOptions, env: NodeJS.ProcessEnv): string | null {
    const raw = options.model?.trim() || env[this.spec.modelEnvVar]?.trim() || this.spec.defaultModel?.trim();
    if (!raw) {
      return null;
    }

    if (!this.spec.stripProviderPrefix) {
      return raw;
    }

    const normalizedProvider = `${this.spec.id.toLowerCase()}/`;
    if (raw.toLowerCase().startsWith(normalizedProvider)) {
      return raw.slice(normalizedProvider.length).trim();
    }

    return raw;
  }

  private resolveEndpoint(env: NodeJS.ProcessEnv, fallbackPath: string): string | null {
    const endpointOverride = this.spec.endpoint.endpointEnvVar
      ? env[this.spec.endpoint.endpointEnvVar]?.trim()
      : undefined;
    if (endpointOverride) {
      return endpointOverride;
    }

    const resolvedBaseUrl =
      this.spec.endpoint.resolveBaseUrl?.(env)?.trim() ||
      (this.spec.endpoint.baseUrlEnvVar ? env[this.spec.endpoint.baseUrlEnvVar]?.trim() : undefined) ||
      this.spec.endpoint.baseUrl?.trim();

    if (!resolvedBaseUrl) {
      return null;
    }

    const endpointPath =
      (this.spec.endpoint.endpointPathEnvVar
        ? env[this.spec.endpoint.endpointPathEnvVar]?.trim()
        : undefined) ||
      this.spec.endpoint.endpointPath ||
      fallbackPath;

    const normalizedBaseUrl = resolvedBaseUrl.replace(/\/+$/, "");
    const normalizedPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
    return `${normalizedBaseUrl}${normalizedPath}`;
  }

  private resolveCredential(env: NodeJS.ProcessEnv): ResolvedCredential | null {
    const auth = this.spec.auth;
    if (!auth?.envVars || auth.envVars.length === 0) {
      return null;
    }

    for (const envVar of auth.envVars) {
      const value = env[envVar]?.trim();
      if (value) {
        return {
          envVar,
          value
        };
      }
    }

    if (auth.optional) {
      return null;
    }

    throw new ProviderAuthenticationError(
      this.id,
      `set one of: ${auth.envVars.join(", ")}`
    );
  }

  private buildHeaders(
    env: NodeJS.ProcessEnv,
    credential: ResolvedCredential | null,
    contentType: string
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": contentType
    };

    for (const [key, value] of Object.entries(this.spec.fixedHeaders ?? {})) {
      if (value.trim()) {
        headers[key] = value;
      }
    }

    for (const entry of this.spec.headersFromEnv ?? []) {
      const value = env[entry.envVar]?.trim();
      if (value) {
        headers[entry.name] = value;
      }
    }

    if (!credential) {
      return headers;
    }

    const headerType = this.resolveAuthHeaderType(credential.envVar);
    if (headerType === "bearer") {
      const normalized = credential.value.replace(/^Bearer\s+/i, "").trim();
      headers.Authorization = `Bearer ${normalized}`;
      return headers;
    }

    if (headerType === "x-api-key") {
      headers["x-api-key"] = credential.value;
      return headers;
    }

    if (headerType === "api-key") {
      headers["api-key"] = credential.value;
      return headers;
    }

    return headers;
  }

  private resolveAuthHeaderType(sourceEnvVar: string): ExtendedHttpAuthHeader {
    const auth = this.spec.auth;
    if (!auth) {
      return "bearer";
    }

    if (auth.oauthTokenHeader && sourceEnvVar.toUpperCase().includes("OAUTH_TOKEN")) {
      return auth.oauthTokenHeader;
    }

    return auth.header ?? "bearer";
  }

  private describeEndpointEnvHints(): string {
    const hints = [
      this.spec.endpoint.endpointEnvVar,
      this.spec.endpoint.baseUrlEnvVar
    ].filter((value): value is string => Boolean(value));

    if (hints.length === 0) {
      return "provider endpoint settings";
    }

    return hints.join(" or ");
  }

  private async invokeJsonEndpoint(params: {
    endpoint: string;
    payload: Record<string, unknown>;
    options: ProviderInvokeOptions;
    parseText: (payload: unknown) => string | null;
    parseSessionId: (payload: unknown) => string | null;
    headers: Record<string, string>;
  }): Promise<ProviderExecutionResult> {
    let response: Response;

    try {
      response = await this.fetchFn(params.endpoint, {
        method: "POST",
        headers: params.headers,
        body: JSON.stringify(params.payload)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        code: 1,
        stdout: "",
        stderr: ensureTrailingNewline(`Request failed: ${message}`)
      };
    }

    const raw = await response.text();
    const parsed = safeParseJson(raw);

    if (!response.ok) {
      const detail = extractErrorDetail(parsed) || raw || `HTTP ${response.status}`;
      return {
        code: 1,
        stdout: "",
        stderr: ensureTrailingNewline(`HTTP ${response.status}: ${detail}`)
      };
    }

    if (!parsed.ok) {
      return {
        code: 1,
        stdout: "",
        stderr: ensureTrailingNewline("Provider response was not valid JSON")
      };
    }

    const text = params.parseText(parsed.value);
    if (!text) {
      return {
        code: 1,
        stdout: "",
        stderr: ensureTrailingNewline("Provider response did not include text output")
      };
    }

    const normalized = ensureTrailingNewline(text);
    params.options.onStdout?.(normalized);

    return {
      code: 0,
      stdout: normalized,
      stderr: "",
      providerSessionId: params.parseSessionId(parsed.value) ?? undefined
    };
  }
}

function buildChatMessages(options: ProviderInvokeOptions): Array<Record<string, string>> {
  const messages: Array<Record<string, string>> = [];

  const systemPrompt = options.systemPrompt?.trim();
  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt
    });
  }

  messages.push({
    role: "user",
    content: options.message
  });

  return messages;
}

function extractOpenAiLikeText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const outputText = extractStringValue(record.output_text);
  if (outputText) {
    return outputText;
  }

  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice && typeof firstChoice.message === "object" ? (firstChoice.message as Record<string, unknown>) : undefined;
  const messageText = extractOpenAiContent(message?.content);
  if (messageText) {
    return messageText;
  }

  const output = Array.isArray(record.output) ? record.output : [];
  for (const entry of output) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const outputEntry = entry as Record<string, unknown>;
    const content = Array.isArray(outputEntry.content) ? outputEntry.content : [];
    const contentText = extractOpenAiContent(content);
    if (contentText) {
      return contentText;
    }
  }

  return null;
}

function extractAnthropicText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const content = Array.isArray(record.content) ? record.content : [];

  const chunks: string[] = [];
  for (const entry of content) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const text = extractStringValue((entry as Record<string, unknown>).text);
    if (text) {
      chunks.push(text);
    }
  }

  if (chunks.length > 0) {
    return chunks.join("\n");
  }

  return extractStringValue(record.output_text);
}

function extractBedrockText(output: ConverseCommandOutput): string | null {
  const content = output.output?.message?.content ?? [];
  const chunks: string[] = [];

  for (const part of content) {
    const text = extractStringValue(part.text);
    if (text) {
      chunks.push(text);
    }
  }

  if (chunks.length === 0) {
    return null;
  }

  return chunks.join("\n");
}

function extractOpenAiContent(content: unknown): string | null {
  if (typeof content === "string") {
    return content.trim() || null;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const chunks: string[] = [];
  for (const entry of content) {
    if (typeof entry === "string") {
      const normalized = entry.trim();
      if (normalized) {
        chunks.push(normalized);
      }
      continue;
    }

    if (!entry || typeof entry !== "object") {
      continue;
    }

    const text = extractStringValue((entry as Record<string, unknown>).text);
    if (text) {
      chunks.push(text);
    }
  }

  if (chunks.length === 0) {
    return null;
  }

  return chunks.join("\n");
}

function extractErrorDetail(payload: SafeJsonParseResult): string | null {
  if (!payload.ok || !payload.value || typeof payload.value !== "object") {
    return null;
  }

  const record = payload.value as Record<string, unknown>;
  const directMessage = extractStringValue(record.message);
  if (directMessage) {
    return directMessage;
  }

  const errorEntry = record.error;
  if (!errorEntry || typeof errorEntry !== "object") {
    return null;
  }

  return extractStringValue((errorEntry as Record<string, unknown>).message);
}

type SafeJsonParseResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
    };

function safeParseJson(raw: string): SafeJsonParseResult {
  try {
    return {
      ok: true,
      value: JSON.parse(raw) as unknown
    };
  } catch {
    return { ok: false };
  }
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function extractStringValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolvePositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
