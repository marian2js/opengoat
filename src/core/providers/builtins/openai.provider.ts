import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError
} from "../errors.js";
import { BaseProvider } from "../base-provider.js";
import type { ProviderExecutionResult, ProviderInvokeOptions } from "../types.js";

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
    const apiKey = env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderAuthenticationError(this.id, "set OPENAI_API_KEY");
    }

    const endpoint = env.OPENGOAT_OPENAI_ENDPOINT?.trim() || "https://api.openai.com/v1/responses";
    const model = options.model || env.OPENGOAT_OPENAI_MODEL || "gpt-4.1-mini";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: options.message
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

    const output = extractOpenAIResponseText(responseText);
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

function extractOpenAIResponseText(raw: string): string {
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    throw new ProviderRuntimeError("openai", "received non-JSON response");
  }

  if (typeof payload !== "object" || payload === null) {
    throw new ProviderRuntimeError("openai", "received invalid response payload");
  }

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
