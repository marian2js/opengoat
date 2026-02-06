import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError
} from "../../errors.js";
import { BaseProvider } from "../../base-provider.js";
import type { ProviderExecutionResult, ProviderInvokeOptions } from "../../types.js";

export class OpenRouterProvider extends BaseProvider {
  public constructor() {
    super({
      id: "openrouter",
      displayName: "OpenRouter",
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
    const apiKey = env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderAuthenticationError(this.id, "set OPENROUTER_API_KEY");
    }

    const endpoint =
      env.OPENGOAT_OPENROUTER_ENDPOINT?.trim() || "https://openrouter.ai/api/v1/chat/completions";
    const model = options.model || env.OPENGOAT_OPENROUTER_MODEL || "openai/gpt-4o-mini";

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };

    if (env.OPENGOAT_OPENROUTER_HTTP_REFERER?.trim()) {
      headers["HTTP-Referer"] = env.OPENGOAT_OPENROUTER_HTTP_REFERER.trim();
    }

    if (env.OPENGOAT_OPENROUTER_X_TITLE?.trim()) {
      headers["X-Title"] = env.OPENGOAT_OPENROUTER_X_TITLE.trim();
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: options.message }]
      })
    });

    const responseText = await response.text();
    if (!response.ok) {
      return {
        code: 1,
        stdout: "",
        stderr: formatHttpError(response.status, responseText)
      };
    }

    const output = extractOpenRouterResponseText(responseText);
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

function extractOpenRouterResponseText(raw: string): string {
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    throw new ProviderRuntimeError("openrouter", "received non-JSON response");
  }

  if (typeof payload !== "object" || payload === null) {
    throw new ProviderRuntimeError("openrouter", "received invalid response payload");
  }

  const record = payload as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const first = record.choices?.[0]?.message?.content;
  if (typeof first === "string" && first.length > 0) {
    return ensureTrailingNewline(first);
  }

  if (Array.isArray(first)) {
    const text = first
      .filter((entry) => entry.type === "text" && typeof entry.text === "string")
      .map((entry) => entry.text as string)
      .join("\n");

    if (text) {
      return ensureTrailingNewline(text);
    }
  }

  throw new ProviderRuntimeError("openrouter", "no textual output found in response");
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
