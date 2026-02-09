import { VercelAiTextRuntime, parseLlmRuntimeError, type OpenAiCompatibleTextRuntime } from "../../../llm/index.js";
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

interface GrokProviderDeps {
  runtime?: OpenAiCompatibleTextRuntime;
}

export class GrokProvider extends BaseProvider {
  private readonly runtime: OpenAiCompatibleTextRuntime;

  public constructor(deps: GrokProviderDeps = {}) {
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
    this.runtime = deps.runtime ?? new VercelAiTextRuntime();
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);

    const env = options.env ?? process.env;
    const apiKey = env.XAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderAuthenticationError(this.id, "set XAI_API_KEY");
    }

    const endpoint = resolveGrokEndpoint(env);
    const style = resolveApiStyle(env, endpoint);
    const model = options.model || env.GROK_MODEL || DEFAULT_GROK_MODEL;

    try {
      const result = await this.runtime.generateText({
        providerName: this.id,
        apiKey,
        baseURL: resolveBaseUrl(env),
        endpointOverride: env.GROK_ENDPOINT?.trim(),
        endpointPathOverride: env.GROK_ENDPOINT_PATH?.trim(),
        style,
        model,
        message: options.message,
        systemPrompt: options.systemPrompt,
        abortSignal: options.abortSignal
      });

      options.onStdout?.(result.text);
      return {
        code: 0,
        stdout: result.text,
        stderr: "",
        providerSessionId: result.providerSessionId
      };
    } catch (error) {
      if (error instanceof ProviderRuntimeError) {
        throw error;
      }
      const details = parseLlmRuntimeError(error);
      return {
        code: 1,
        stdout: "",
        stderr: ensureTrailingNewline(details.message)
      };
    }
  }

  public override invokeAuth(): Promise<ProviderExecutionResult> {
    throw new UnsupportedProviderActionError(this.id, "auth");
  }
}

function resolveGrokEndpoint(env: NodeJS.ProcessEnv): string {
  const endpointOverride = env.GROK_ENDPOINT?.trim();
  if (endpointOverride) {
    return endpointOverride;
  }

  const baseUrl = resolveBaseUrl(env).replace(/\/+$/, "");
  const endpointPath = env.GROK_ENDPOINT_PATH?.trim() || DEFAULT_GROK_ENDPOINT_PATH;

  return `${baseUrl}${endpointPath.startsWith("/") ? "" : "/"}${endpointPath}`;
}

function resolveApiStyle(env: NodeJS.ProcessEnv, endpoint: string): "responses" | "chat" {
  const explicit = env.GROK_API_STYLE?.trim().toLowerCase();
  if (explicit === "responses" || explicit === "chat") {
    return explicit;
  }

  if (endpoint.toLowerCase().includes("/chat/completions")) {
    return "chat";
  }

  return "responses";
}

function resolveBaseUrl(env: NodeJS.ProcessEnv): string {
  return env.GROK_BASE_URL?.trim() || DEFAULT_GROK_BASE_URL;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
