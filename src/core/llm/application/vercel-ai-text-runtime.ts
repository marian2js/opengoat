import { generateText } from "ai";
import {
  createOpenAI,
  type OpenAIProvider,
  type OpenAIProviderSettings
} from "@ai-sdk/openai";
import { ProviderRuntimeError } from "../../providers/errors.js";
import type {
  OpenAiCompatibleTextRequest,
  OpenAiCompatibleTextResult,
  OpenAiCompatibleTextRuntime
} from "../domain/text-runtime.js";

interface VercelAiTextRuntimeDeps {
  generateTextFn?: typeof generateText;
  createOpenAIProvider?: typeof createOpenAI;
  fetchFn?: typeof fetch;
}

export interface LlmRuntimeErrorDetails {
  statusCode?: number;
  message: string;
}

export class VercelAiTextRuntime implements OpenAiCompatibleTextRuntime {
  private readonly generateTextFn: typeof generateText;
  private readonly createOpenAIProvider: typeof createOpenAI;
  private readonly fetchFn: typeof fetch;

  public constructor(deps: VercelAiTextRuntimeDeps = {}) {
    this.generateTextFn = deps.generateTextFn ?? generateText;
    this.createOpenAIProvider = deps.createOpenAIProvider ?? createOpenAI;
    this.fetchFn = deps.fetchFn ?? fetch;
  }

  public async generateText(request: OpenAiCompatibleTextRequest): Promise<OpenAiCompatibleTextResult> {
    const provider = this.createOpenAIProvider({
      apiKey: request.apiKey,
      baseURL: request.baseURL,
      name: request.providerName,
      headers: request.headers,
      fetch: this.createFetchMiddleware(request, this.fetchFn)
    });
    const model = resolveModel(provider, request.style, request.model);
    const result = await this.generateTextFn({
      model,
      prompt: request.message,
      system: request.systemPrompt?.trim() || undefined
    });

    const text = result.text?.trim();
    if (!text) {
      throw new ProviderRuntimeError(request.providerName, "no textual output found in response");
    }

    return {
      text: ensureTrailingNewline(text),
      providerSessionId: resolveResponseId(result.providerMetadata)
    };
  }

  private createFetchMiddleware(
    request: OpenAiCompatibleTextRequest,
    fetchFn: typeof fetch
  ): OpenAIProviderSettings["fetch"] {
    const endpointOverride = request.endpointOverride?.trim();
    const endpointPathOverride = request.endpointPathOverride?.trim();

    if (!endpointOverride && !endpointPathOverride) {
      return fetchFn;
    }

    return async (input, init) => {
      if (endpointOverride) {
        return fetchFn(endpointOverride, init);
      }

      const nextUrl = rewriteEndpointPath(input, endpointPathOverride ?? "");
      return fetchFn(nextUrl, init);
    };
  }
}

function resolveModel(provider: OpenAIProvider, style: OpenAiCompatibleTextRequest["style"], model: string) {
  if (style === "chat") {
    return provider.chat(model);
  }

  return provider.responses(model);
}

function rewriteEndpointPath(input: Parameters<typeof fetch>[0], pathValue: string): string {
  const normalizedPath = normalizePath(pathValue);
  const originalUrl = toUrlString(input);
  const url = new URL(originalUrl);
  url.pathname = normalizedPath;
  return url.toString();
}

function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function toUrlString(value: Parameters<typeof fetch>[0]): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof URL) {
    return value.toString();
  }

  return value.url;
}

function resolveResponseId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const openai = record.openai;
  if (!openai || typeof openai !== "object") {
    return undefined;
  }

  const responseId = (openai as Record<string, unknown>).responseId;
  return typeof responseId === "string" && responseId.trim().length > 0 ? responseId : undefined;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

export function parseLlmRuntimeError(error: unknown): LlmRuntimeErrorDetails {
  if (error && typeof error === "object") {
    const record = error as {
      statusCode?: unknown;
      responseBody?: unknown;
      message?: unknown;
    };

    const statusCode = typeof record.statusCode === "number" ? record.statusCode : undefined;
    const responseBody = typeof record.responseBody === "string" ? record.responseBody.trim() : "";
    const message = typeof record.message === "string" ? record.message.trim() : "";

    if (statusCode !== undefined) {
      if (responseBody) {
        return {
          statusCode,
          message: `HTTP ${statusCode}: ${responseBody}`
        };
      }

      if (message) {
        return {
          statusCode,
          message: `HTTP ${statusCode}: ${message}`
        };
      }

      return {
        statusCode,
        message: `HTTP ${statusCode}`
      };
    }

    if (message) {
      return {
        message
      };
    }
  }

  return {
    message: "LLM runtime request failed"
  };
}
