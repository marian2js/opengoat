import { generateText } from "ai";
import {
  createOpenAI,
  type OpenAIProvider,
  type OpenAIProviderSettings,
} from "@ai-sdk/openai";
import { ProviderRuntimeError } from "../../providers/errors.js";
import type {
  OpenAiCompatibleTextRequest,
  OpenAiCompatibleTextResult,
  OpenAiCompatibleTextRuntime,
} from "../domain/text-runtime.js";

interface VercelAiTextRuntimeDeps {
  generateTextFn?: typeof generateText;
  createOpenAIProvider?: typeof createOpenAI;
  fetchFn?: typeof fetch;
  requestTimeoutMs?: number;
  maxRetries?: number;
}

export interface LlmRuntimeErrorDetails {
  statusCode?: number;
  message: string;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 0;

export class VercelAiTextRuntime implements OpenAiCompatibleTextRuntime {
  private readonly generateTextFn: typeof generateText;
  private readonly createOpenAIProvider: typeof createOpenAI;
  private readonly fetchFn: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;

  public constructor(deps: VercelAiTextRuntimeDeps = {}) {
    this.generateTextFn = deps.generateTextFn ?? generateText;
    this.createOpenAIProvider = deps.createOpenAIProvider ?? createOpenAI;
    this.fetchFn = deps.fetchFn ?? fetch;
    this.requestTimeoutMs = normalizePositiveInt(
      deps.requestTimeoutMs,
      DEFAULT_REQUEST_TIMEOUT_MS
    );
    this.maxRetries = normalizeNonNegativeInt(
      deps.maxRetries,
      DEFAULT_MAX_RETRIES
    );
  }

  public async generateText(
    request: OpenAiCompatibleTextRequest
  ): Promise<OpenAiCompatibleTextResult> {
    const provider = this.createOpenAIProvider({
      apiKey: request.apiKey,
      baseURL: request.baseURL,
      name: request.providerName,
      headers: request.headers,
      fetch: this.createFetchMiddleware(request, this.fetchFn),
    });
    const model = resolveModel(provider, request.style, request.model);
    const result = await this.generateTextFn({
      model,
      prompt: request.message,
      system: request.systemPrompt?.trim() || undefined,
      maxRetries: this.maxRetries,
    });

    const text = result.text?.trim();
    if (!text) {
      throw new ProviderRuntimeError(
        request.providerName,
        "no textual output found in response"
      );
    }

    return {
      text: ensureTrailingNewline(text),
      providerSessionId: resolveResponseId(result.providerMetadata),
    };
  }

  private createFetchMiddleware(
    request: OpenAiCompatibleTextRequest,
    fetchFn: typeof fetch
  ): OpenAIProviderSettings["fetch"] {
    const endpointOverride = request.endpointOverride?.trim();
    const endpointPathOverride = request.endpointPathOverride?.trim();

    return async (input, init) => {
      const nextUrl = endpointOverride
        ? endpointOverride
        : endpointPathOverride
        ? rewriteEndpointPath(input, endpointPathOverride, request.baseURL)
        : toUrlString(input);
      return fetchWithTimeout(fetchFn, nextUrl, init, this.requestTimeoutMs);
    };
  }
}

async function fetchWithTimeout(
  fetchFn: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  timeoutMs: number
): Promise<Response> {
  const upstreamSignal = init?.signal;
  const timeoutController = new AbortController();
  let upstreamAbortListener: (() => void) | undefined;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  if (upstreamSignal?.aborted) {
    timeoutController.abort(upstreamSignal.reason);
  } else if (upstreamSignal) {
    upstreamAbortListener = () =>
      timeoutController.abort(upstreamSignal.reason);
    upstreamSignal.addEventListener("abort", upstreamAbortListener, {
      once: true,
    });
  }

  try {
    const timeoutPromise = new Promise<Response>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        timeoutController.abort();
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      timeoutController.signal.addEventListener(
        "abort",
        () => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        },
        { once: true }
      );
    });

    return await Promise.race([
      fetchFn(input, {
        ...init,
        signal: timeoutController.signal,
      }),
      timeoutPromise,
    ]);
  } catch (error) {
    if (!upstreamSignal?.aborted && isAbortError(error)) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    if (upstreamSignal && upstreamAbortListener) {
      upstreamSignal.removeEventListener("abort", upstreamAbortListener);
    }
  }
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" && name.toLowerCase() === "aborterror";
}

function normalizePositiveInt(
  value: number | undefined,
  fallback: number
): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) {
    return fallback;
  }
  return Math.floor(value ?? fallback);
}

function normalizeNonNegativeInt(
  value: number | undefined,
  fallback: number
): number {
  if (!Number.isFinite(value) || (value ?? 0) < 0) {
    return fallback;
  }
  return Math.floor(value ?? fallback);
}

function resolveModel(
  provider: OpenAIProvider,
  style: OpenAiCompatibleTextRequest["style"],
  model: string
) {
  if (style === "chat") {
    return provider.chat(model);
  }

  return provider.responses(model);
}

function rewriteEndpointPath(
  input: Parameters<typeof fetch>[0],
  pathValue: string,
  baseURL: string
): string {
  const normalizedPath = normalizePath(pathValue);
  const originalUrl = toUrlString(input);
  const url = new URL(originalUrl);
  url.pathname = joinEndpointPath(
    resolveBasePathPrefix(baseURL),
    normalizedPath
  );
  return url.toString();
}

function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function resolveBasePathPrefix(baseURL: string): string {
  const pathname = new URL(baseURL).pathname.trim();
  if (!pathname || pathname === "/") {
    return "";
  }
  return pathname.replace(/\/+$/, "");
}

function joinEndpointPath(
  basePathPrefix: string,
  endpointPath: string
): string {
  if (!basePathPrefix) {
    return endpointPath;
  }

  if (
    endpointPath === basePathPrefix ||
    endpointPath.startsWith(`${basePathPrefix}/`)
  ) {
    return endpointPath;
  }

  return `${basePathPrefix}${endpointPath}`;
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
  return typeof responseId === "string" && responseId.trim().length > 0
    ? responseId
    : undefined;
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

    const statusCode =
      typeof record.statusCode === "number" ? record.statusCode : undefined;
    const responseBody =
      typeof record.responseBody === "string" ? record.responseBody.trim() : "";
    const message =
      typeof record.message === "string" ? record.message.trim() : "";

    if (statusCode !== undefined) {
      if (responseBody) {
        return {
          statusCode,
          message: `HTTP ${statusCode}: ${responseBody}`,
        };
      }

      if (message) {
        return {
          statusCode,
          message: `HTTP ${statusCode}: ${message}`,
        };
      }

      return {
        statusCode,
        message: `HTTP ${statusCode}`,
      };
    }

    if (message) {
      return {
        message,
      };
    }
  }

  return {
    message: "LLM runtime request failed",
  };
}
