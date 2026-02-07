import { VercelAiTextRuntime, parseLlmRuntimeError, type OpenAiCompatibleTextRuntime } from "../../../llm/index.js";
import {
  ProviderAuthenticationError,
  UnsupportedProviderActionError
} from "../../errors.js";
import { BaseProvider } from "../../base-provider.js";
import type { ProviderExecutionResult, ProviderInvokeOptions } from "../../types.js";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";

interface OpenRouterProviderDeps {
  runtime?: OpenAiCompatibleTextRuntime;
}

export class OpenRouterProvider extends BaseProvider {
  private readonly runtime: OpenAiCompatibleTextRuntime;

  public constructor(deps: OpenRouterProviderDeps = {}) {
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
    this.runtime = deps.runtime ?? new VercelAiTextRuntime();
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);

    const env = options.env ?? process.env;
    const apiKey = env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new ProviderAuthenticationError(this.id, "set OPENROUTER_API_KEY");
    }

    const model = options.model || env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
    const headers = resolveHeaders(env);

    try {
      const result = await this.runtime.generateText({
        providerName: this.id,
        apiKey,
        baseURL: DEFAULT_OPENROUTER_BASE_URL,
        endpointOverride: env.OPENROUTER_ENDPOINT?.trim(),
        style: "chat",
        model,
        message: options.message,
        systemPrompt: options.systemPrompt,
        headers
      });

      options.onStdout?.(result.text);
      return {
        code: 0,
        stdout: result.text,
        stderr: "",
        providerSessionId: result.providerSessionId
      };
    } catch (error) {
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

function resolveHeaders(env: NodeJS.ProcessEnv): Record<string, string> {
  const headers: Record<string, string> = {};

  const referer = env.OPENROUTER_HTTP_REFERER?.trim();
  if (referer) {
    headers["HTTP-Referer"] = referer;
  }

  const title = env.OPENROUTER_X_TITLE?.trim();
  if (title) {
    headers["X-Title"] = title;
  }

  return headers;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
