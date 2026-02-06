import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError
} from "../../errors.js";
import { BaseProvider } from "../../base-provider.js";
import type { ProviderExecutionResult, ProviderInvokeOptions } from "../../types.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_ENDPOINT_PATH = "/responses";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

export class OpenAIProvider extends BaseProvider {
  public constructor() {
    super({
      id: "openai",
      displayName: "OpenAI",
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
    const apiKey = env.OPENAI_API_KEY?.trim() || env.OPENGOAT_OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderAuthenticationError(this.id, "set OPENAI_API_KEY");
    }

    const model = resolveModel(options, env);
    if (!model) {
      return {
        code: 1,
        stdout: "",
        stderr:
          "Missing model for OpenAI-compatible base URL. Set OPENGOAT_OPENAI_MODEL (or OPENAI_MODEL) or pass --model.\n"
      };
    }

    const explicitEndpoint = Boolean(resolveEndpointOverride(env));
    const explicitEndpointPath = Boolean(resolveEndpointPathOverride(env));
    const explicitStyle = Boolean(resolveApiStyleOverride(env));
    const primaryEndpoint = resolveOpenAIEndpoint(env);
    const primaryStyle = resolveApiStyle(env, primaryEndpoint);
    let finalStyle: "responses" | "chat" = primaryStyle;

    let response = await performOpenAIRequest({
      endpoint: primaryEndpoint,
      style: primaryStyle,
      apiKey,
      model,
      message: options.message,
      systemPrompt: options.systemPrompt
    });

    if (
      response.status === 404 &&
      !explicitEndpoint &&
      !explicitEndpointPath &&
      !explicitStyle &&
      primaryStyle === "responses"
    ) {
      const fallbackEndpoint = resolveOpenAIEndpoint(env, "/chat/completions");
      response = await performOpenAIRequest({
        endpoint: fallbackEndpoint,
        style: "chat",
        apiKey,
        model,
        message: options.message,
        systemPrompt: options.systemPrompt
      });
      finalStyle = "chat";
    }

    if (!response.ok) {
      const responseText = await response.text();
      return {
        code: 1,
        stdout: "",
        stderr: formatHttpError(response.status, responseText)
      };
    }

    const responseText = await response.text();
    const output = extractOpenAIResponseText(responseText, finalStyle);
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

function resolveOpenAIEndpoint(env: NodeJS.ProcessEnv, defaultPath = DEFAULT_OPENAI_ENDPOINT_PATH): string {
  const endpointOverride = resolveEndpointOverride(env);
  if (endpointOverride) {
    return endpointOverride;
  }

  const baseUrl = resolveBaseUrl(env).replace(/\/+$/, "");
  const endpointPath = resolveEndpointPathOverride(env) || defaultPath;

  return `${baseUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`;
}

function resolveApiStyle(env: NodeJS.ProcessEnv, endpoint: string): "responses" | "chat" {
  const explicit = resolveApiStyleOverride(env);
  if (explicit === "responses" || explicit === "chat") {
    return explicit;
  }

  if (endpoint.toLowerCase().includes("/chat/completions")) {
    return "chat";
  }

  return "responses";
}

function resolveEndpointOverride(env: NodeJS.ProcessEnv): string | undefined {
  return env.OPENGOAT_OPENAI_ENDPOINT?.trim() || env.OPENAI_ENDPOINT?.trim();
}

function resolveEndpointPathOverride(env: NodeJS.ProcessEnv): string | undefined {
  return env.OPENGOAT_OPENAI_ENDPOINT_PATH?.trim() || env.OPENAI_ENDPOINT_PATH?.trim();
}

function resolveApiStyleOverride(env: NodeJS.ProcessEnv): string | undefined {
  return env.OPENGOAT_OPENAI_API_STYLE?.trim().toLowerCase() || env.OPENAI_API_STYLE?.trim().toLowerCase();
}

function resolveBaseUrl(env: NodeJS.ProcessEnv): string {
  return env.OPENGOAT_OPENAI_BASE_URL?.trim() || env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL;
}

function resolveModel(options: ProviderInvokeOptions, env: NodeJS.ProcessEnv): string | null {
  const explicitModel = options.model?.trim() || env.OPENGOAT_OPENAI_MODEL?.trim() || env.OPENAI_MODEL?.trim();
  if (explicitModel) {
    return explicitModel;
  }

  if (shouldUseDefaultOpenAIModel(env)) {
    return DEFAULT_OPENAI_MODEL;
  }

  return null;
}

function shouldUseDefaultOpenAIModel(env: NodeJS.ProcessEnv): boolean {
  if (resolveEndpointOverride(env) || resolveEndpointPathOverride(env) || resolveApiStyleOverride(env)) {
    return false;
  }

  const baseUrl = resolveBaseUrl(env).replace(/\/+$/, "");
  return baseUrl === DEFAULT_OPENAI_BASE_URL;
}

async function performOpenAIRequest(params: {
  endpoint: string;
  style: "responses" | "chat";
  apiKey: string;
  model: string;
  message: string;
  systemPrompt?: string;
}): Promise<Response> {
  return fetch(params.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildRequestPayload(params.style, params.model, params.message, params.systemPrompt))
  });
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

function extractOpenAIResponseText(raw: string, style: "responses" | "chat"): string {
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    throw new ProviderRuntimeError("openai", "received non-JSON response");
  }

  if (typeof payload !== "object" || payload === null) {
    throw new ProviderRuntimeError("openai", "received invalid response payload");
  }

  if (style === "chat") {
    return extractOpenAIChatText(payload);
  }

  return extractOpenAIResponsesText(payload);
}

function extractOpenAIResponsesText(payload: unknown): string {
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
    throw new ProviderRuntimeError("openai", "no textual output found in response");
  }

  return ensureTrailingNewline(textBlocks);
}

function extractOpenAIChatText(payload: unknown): string {
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

  throw new ProviderRuntimeError("openai", "no textual output found in response");
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
