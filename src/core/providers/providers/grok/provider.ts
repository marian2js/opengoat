import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError
} from "../../errors.js";
import { BaseProvider } from "../../base-provider.js";
import type { ProviderExecutionResult, ProviderInvokeOptions } from "../../types.js";

const DEFAULT_GROK_BASE_URL = "https://api.x.ai/v1";
const DEFAULT_GROK_ENDPOINT_PATH = "/responses";
const DEFAULT_GROK_MODEL = "grok-4";

export class GrokProvider extends BaseProvider {
  public constructor() {
    super({
      id: "grok",
      displayName: "Grok",
      kind: "http",
      capabilities: {
        agent: false,
        model: true,
        auth: false,
        passthrough: false
      }
    });
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);

    const env = options.env ?? process.env;
    const apiKey = env.XAI_API_KEY?.trim() || env.OPENGOAT_GROK_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderAuthenticationError(this.id, "set XAI_API_KEY");
    }

    const endpoint = resolveGrokEndpoint(env);
    const model = options.model || env.OPENGOAT_GROK_MODEL || DEFAULT_GROK_MODEL;
    const style = resolveApiStyle(env, endpoint);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildRequestPayload(style, model, options.message, options.systemPrompt))
    });

    const responseText = await response.text();
    if (!response.ok) {
      return {
        code: 1,
        stdout: "",
        stderr: formatHttpError(response.status, responseText)
      };
    }

    const output = extractGrokResponseText(responseText, style);
    options.onStdout?.(output);

    return {
      code: 0,
      stdout: output,
      stderr: ""
    };
  }

  public override invokeAuth(): Promise<ProviderExecutionResult> {
    throw new UnsupportedProviderActionError(this.id, "auth");
  }
}

function resolveGrokEndpoint(env: NodeJS.ProcessEnv): string {
  const endpointOverride = env.OPENGOAT_GROK_ENDPOINT?.trim();
  if (endpointOverride) {
    return endpointOverride;
  }

  const baseUrl = (env.OPENGOAT_GROK_BASE_URL?.trim() || DEFAULT_GROK_BASE_URL).replace(/\/+$/, "");
  const endpointPath = env.OPENGOAT_GROK_ENDPOINT_PATH?.trim() || DEFAULT_GROK_ENDPOINT_PATH;

  return `${baseUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`;
}

function resolveApiStyle(env: NodeJS.ProcessEnv, endpoint: string): "responses" | "chat" {
  const explicit = env.OPENGOAT_GROK_API_STYLE?.trim().toLowerCase();
  if (explicit === "responses" || explicit === "chat") {
    return explicit;
  }

  if (endpoint.toLowerCase().includes("/chat/completions")) {
    return "chat";
  }

  return "responses";
}

function buildRequestPayload(
  style: "responses" | "chat",
  model: string,
  message: string,
  systemPrompt?: string
): Record<string, unknown> {
  const trimmedSystemPrompt = systemPrompt?.trim();

  if (style === "chat") {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (trimmedSystemPrompt) {
      messages.push({ role: "system", content: trimmedSystemPrompt });
    }

    messages.push({ role: "user", content: message });

    return {
      model,
      messages
    };
  }

  if (trimmedSystemPrompt) {
    return {
      model,
      input: [
        { role: "system", content: trimmedSystemPrompt },
        { role: "user", content: message }
      ]
    };
  }

  return {
    model,
    input: message
  };
}

function extractGrokResponseText(raw: string, style: "responses" | "chat"): string {
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    throw new ProviderRuntimeError("grok", "received non-JSON response");
  }

  if (typeof payload !== "object" || payload === null) {
    throw new ProviderRuntimeError("grok", "received invalid response payload");
  }

  if (style === "chat") {
    return extractGrokChatText(payload);
  }

  return extractGrokResponsesText(payload);
}

function extractGrokResponsesText(payload: unknown): string {
  const record = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof record.output_text === "string" && record.output_text.length > 0) {
    return ensureTrailingNewline(record.output_text);
  }

  const textBlocks = (record.output ?? [])
    .flatMap((entry) => entry.content ?? [])
    .filter((entry) => entry.type === "output_text" && typeof entry.text === "string")
    .map((entry) => entry.text as string)
    .join("\n");

  if (!textBlocks) {
    throw new ProviderRuntimeError("grok", "no textual output found in response");
  }

  return ensureTrailingNewline(textBlocks);
}

function extractGrokChatText(payload: unknown): string {
  const record = payload as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = record.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.length > 0) {
    return ensureTrailingNewline(content);
  }

  if (Array.isArray(content)) {
    const text = content
      .filter((entry) => entry.type === "text" && typeof entry.text === "string")
      .map((entry) => entry.text as string)
      .join("\n");

    if (text) {
      return ensureTrailingNewline(text);
    }
  }

  throw new ProviderRuntimeError("grok", "no textual output found in response");
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function formatHttpError(status: number, body: string): string {
  const content = body.trim();
  if (!content) {
    return `HTTP ${status}\n`;
  }

  return `HTTP ${status}: ${content}\n`;
}
