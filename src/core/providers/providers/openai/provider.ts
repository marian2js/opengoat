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

    const endpoint = resolveOpenAIEndpoint(env);
    const model = options.model || env.OPENGOAT_OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
    const style = resolveApiStyle(env, endpoint);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        style === "chat"
          ? {
              model,
              messages: [{ role: "user", content: options.message }]
            }
          : {
              model,
              input: options.message
            }
      )
    });

    const responseText = await response.text();
    if (!response.ok) {
      return {
        code: 1,
        stdout: "",
        stderr: formatHttpError(response.status, responseText)
      };
    }

    const output = extractOpenAIResponseText(responseText, style);
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

function resolveOpenAIEndpoint(env: NodeJS.ProcessEnv): string {
  const endpointOverride = env.OPENGOAT_OPENAI_ENDPOINT?.trim();
  if (endpointOverride) {
    return endpointOverride;
  }

  const baseUrl = (env.OPENGOAT_OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  const endpointPath = env.OPENGOAT_OPENAI_ENDPOINT_PATH?.trim() || DEFAULT_OPENAI_ENDPOINT_PATH;

  return `${baseUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`;
}

function resolveApiStyle(env: NodeJS.ProcessEnv, endpoint: string): "responses" | "chat" {
  const explicit = env.OPENGOAT_OPENAI_API_STYLE?.trim().toLowerCase();
  if (explicit === "responses" || explicit === "chat") {
    return explicit;
  }

  if (endpoint.toLowerCase().includes("/chat/completions")) {
    return "chat";
  }

  return "responses";
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
