import {
  VercelAiTextRuntime,
  parseLlmRuntimeError,
  type OpenAiCompatibleTextRuntime,
} from "../../../llm/index.js";
import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError,
} from "../../errors.js";
import { BaseProvider } from "../../base-provider.js";
import type {
  ProviderExecutionResult,
  ProviderInvokeOptions,
} from "../../types.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_ENDPOINT_PATH = "/responses";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENAI_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_OPENAI_COMPAT_REQUEST_TIMEOUT_MS = 60_000;

interface OpenAIProviderDeps {
  runtime?: OpenAiCompatibleTextRuntime;
}

export class OpenAIProvider extends BaseProvider {
  private readonly runtime: OpenAiCompatibleTextRuntime;

  public constructor(deps: OpenAIProviderDeps = {}) {
    super({
      id: "openai",
      displayName: "OpenAI",
      kind: "http",
      capabilities: {
        agent: false,
        model: true,
        auth: false,
        passthrough: false,
      },
    });
    this.runtime = deps.runtime ?? new VercelAiTextRuntime();
  }

  public async invoke(
    options: ProviderInvokeOptions
  ): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);

    const env = options.env ?? process.env;
    const apiKey = env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderAuthenticationError(this.id, "set OPENAI_API_KEY");
    }

    const model = resolveModel(options, env);
    if (!model) {
      return {
        code: 1,
        stdout: "",
        stderr:
          "Missing model for OpenAI-compatible base URL. Set OPENAI_MODEL or pass --model.\n",
      };
    }

    const endpoint = resolveOpenAIEndpoint(env);
    const style = resolveApiStyle(env, endpoint);
    const explicitEndpoint = Boolean(resolveEndpointOverride(env));
    const explicitEndpointPath = Boolean(resolveEndpointPathOverride(env));
    const explicitStyle = Boolean(resolveApiStyleOverride(env));

    try {
      const result = await this.runtime.generateText({
        providerName: this.id,
        apiKey,
        baseURL: resolveBaseUrl(env),
        endpointOverride: resolveEndpointOverride(env),
        endpointPathOverride: resolveEndpointPathOverride(env),
        style,
        requestTimeoutMs: resolveRequestTimeoutMs(env),
        model,
        message: options.message,
        systemPrompt: options.systemPrompt,
      });

      options.onStdout?.(result.text);
      return {
        code: 0,
        stdout: result.text,
        stderr: "",
        providerSessionId: result.providerSessionId,
      };
    } catch (error) {
      if (error instanceof ProviderRuntimeError) {
        throw error;
      }
      const details = parseLlmRuntimeError(error);
      const lowerMessage = details.message.toLowerCase();
      const timeoutLikeFailure =
        lowerMessage.includes("timed out") ||
        lowerMessage.includes("timeout") ||
        lowerMessage.includes("headers timeout");
      const canFallback =
        (details.statusCode === 404 || timeoutLikeFailure) &&
        !explicitEndpoint &&
        !explicitEndpointPath &&
        !explicitStyle &&
        style === "responses";

      if (canFallback) {
        return this.invokeChatFallback(options, env, apiKey, model);
      }

      return {
        code: 1,
        stdout: "",
        stderr: ensureTrailingNewline(details.message),
      };
    }
  }

  public override invokeAuth(): Promise<ProviderExecutionResult> {
    throw new UnsupportedProviderActionError(this.id, "auth");
  }

  private async invokeChatFallback(
    options: ProviderInvokeOptions,
    env: NodeJS.ProcessEnv,
    apiKey: string,
    model: string
  ): Promise<ProviderExecutionResult> {
    try {
      const result = await this.runtime.generateText({
        providerName: this.id,
        apiKey,
        baseURL: resolveBaseUrl(env),
        endpointPathOverride: "/chat/completions",
        style: "chat",
        requestTimeoutMs: resolveRequestTimeoutMs(env),
        model,
        message: options.message,
        systemPrompt: options.systemPrompt,
      });

      options.onStdout?.(result.text);
      return {
        code: 0,
        stdout: result.text,
        stderr: "",
        providerSessionId: result.providerSessionId,
      };
    } catch (error) {
      if (error instanceof ProviderRuntimeError) {
        throw error;
      }
      const details = parseLlmRuntimeError(error);
      return {
        code: 1,
        stdout: "",
        stderr: ensureTrailingNewline(details.message),
      };
    }
  }
}

function resolveOpenAIEndpoint(
  env: NodeJS.ProcessEnv,
  defaultPath = DEFAULT_OPENAI_ENDPOINT_PATH
): string {
  const endpointOverride = resolveEndpointOverride(env);
  if (endpointOverride) {
    return endpointOverride;
  }

  const baseUrl = resolveBaseUrl(env).replace(/\/+$/, "");
  const endpointPath = resolveEndpointPathOverride(env) || defaultPath;

  return `${baseUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`;
}

function resolveApiStyle(
  env: NodeJS.ProcessEnv,
  endpoint: string
): "responses" | "chat" {
  const explicit = resolveApiStyleOverride(env);
  if (explicit === "responses" || explicit === "chat") {
    return explicit;
  }

  if (
    !resolveEndpointOverride(env) &&
    !resolveEndpointPathOverride(env) &&
    !isDefaultOpenAIBaseUrl(resolveBaseUrl(env))
  ) {
    return "chat";
  }

  if (endpoint.toLowerCase().includes("/chat/completions")) {
    return "chat";
  }

  return "responses";
}

function resolveEndpointOverride(env: NodeJS.ProcessEnv): string | undefined {
  return env.OPENAI_ENDPOINT?.trim();
}

function resolveEndpointPathOverride(
  env: NodeJS.ProcessEnv
): string | undefined {
  return env.OPENAI_ENDPOINT_PATH?.trim();
}

function resolveApiStyleOverride(env: NodeJS.ProcessEnv): string | undefined {
  return env.OPENAI_API_STYLE?.trim().toLowerCase();
}

function resolveBaseUrl(env: NodeJS.ProcessEnv): string {
  return env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL;
}

function isDefaultOpenAIBaseUrl(value: string): boolean {
  return value.replace(/\/+$/, "") === DEFAULT_OPENAI_BASE_URL;
}

function resolveRequestTimeoutMs(env: NodeJS.ProcessEnv): number {
  const explicitTimeout = env.OPENAI_REQUEST_TIMEOUT_MS?.trim();
  if (explicitTimeout) {
    const parsed = Number(explicitTimeout);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }

  if (!isDefaultOpenAIBaseUrl(resolveBaseUrl(env))) {
    return DEFAULT_OPENAI_COMPAT_REQUEST_TIMEOUT_MS;
  }

  return DEFAULT_OPENAI_REQUEST_TIMEOUT_MS;
}

function resolveModel(
  options: ProviderInvokeOptions,
  env: NodeJS.ProcessEnv
): string | null {
  const explicitModel = options.model?.trim() || env.OPENAI_MODEL?.trim();
  if (explicitModel) {
    return explicitModel;
  }

  if (shouldUseDefaultOpenAIModel(env)) {
    return DEFAULT_OPENAI_MODEL;
  }

  return null;
}

function shouldUseDefaultOpenAIModel(env: NodeJS.ProcessEnv): boolean {
  if (
    resolveEndpointOverride(env) ||
    resolveEndpointPathOverride(env) ||
    resolveApiStyleOverride(env)
  ) {
    return false;
  }

  const baseUrl = resolveBaseUrl(env).replace(/\/+$/, "");
  return isDefaultOpenAIBaseUrl(baseUrl);
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
