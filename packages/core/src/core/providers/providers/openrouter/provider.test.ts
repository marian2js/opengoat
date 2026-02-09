import { describe, expect, it, vi } from "vitest";
import type { OpenAiCompatibleTextRequest, OpenAiCompatibleTextRuntime } from "../../../llm/index.js";
import {
  ProviderAuthenticationError,
  UnsupportedProviderActionError
} from "../../errors.js";
import { OpenRouterProvider } from "./provider.js";

describe("openrouter provider", () => {
  it("parses runtime content output", async () => {
    const runtime = createRuntime(async () => ({ text: "hello from openrouter\n" }));
    const provider = new OpenRouterProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: { OPENROUTER_API_KEY: "test-key" }
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("hello from openrouter\n");
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerName: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        style: "chat",
        model: "openai/gpt-4o-mini"
      })
    );
  });

  it("forwards system prompt and optional headers", async () => {
    const runtime = createRuntime(async () => ({ text: "hello from array content\n" }));
    const provider = new OpenRouterProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      systemPrompt: "System rules.",
      env: {
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_HTTP_REFERER: "https://example.test",
        OPENROUTER_X_TITLE: "OpenGoat"
      }
    });

    expect(result.code).toBe(0);
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "hello",
        systemPrompt: "System rules.",
        headers: {
          "HTTP-Referer": "https://example.test",
          "X-Title": "OpenGoat"
        }
      })
    );
  });

  it("forwards image inputs to the runtime", async () => {
    const runtime = createRuntime(async () => ({ text: "ok\n" }));
    const provider = new OpenRouterProvider({ runtime });

    const result = await provider.invoke({
      message: "Analyze this image",
      images: [
        {
          dataUrl: "data:image/png;base64,aGVsbG8="
        }
      ],
      env: { OPENROUTER_API_KEY: "test-key" }
    });

    expect(result.code).toBe(0);
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [
          {
            image: "aGVsbG8=",
            mediaType: "image/png"
          }
        ]
      })
    );
  });

  it("returns non-zero result when runtime request fails", async () => {
    const runtime = createRuntime(async () => ({ text: "unused\n" }));
    runtime.generateText.mockRejectedValueOnce({
      statusCode: 401,
      responseBody: "{\"error\":\"invalid_api_key\"}"
    });
    const provider = new OpenRouterProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: { OPENROUTER_API_KEY: "test-key" }
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("HTTP 401");
  });

  it("requires API key and does not support auth action", async () => {
    const provider = new OpenRouterProvider();

    await expect(provider.invoke({ message: "hello", env: {} })).rejects.toThrow(
      ProviderAuthenticationError
    );
    expect(() => provider.invokeAuth()).toThrow(UnsupportedProviderActionError);
  });
});

function createRuntime(
  implementation: (request: OpenAiCompatibleTextRequest) => Promise<{ text: string; providerSessionId?: string }>
): OpenAiCompatibleTextRuntime & { generateText: ReturnType<typeof vi.fn> } {
  const generateText = vi.fn(implementation);
  return {
    generateText
  };
}
