import { describe, expect, it, vi } from "vitest";
import type {
  OpenAiCompatibleTextRequest,
  OpenAiCompatibleTextRuntime,
} from "../../../llm/index.js";
import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError,
} from "../../errors.js";
import { OpenAIProvider } from "./provider.js";

describe("openai provider", () => {
  it("parses runtime output and forwards stdout callback", async () => {
    const runtime = createRuntime(async () => ({
      text: "hello from openai\n",
      providerSessionId: "resp_123",
    }));
    const onStdout = vi.fn();
    const provider = new OpenAIProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: { OPENAI_API_KEY: "test-key" },
      onStdout,
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("hello from openai\n");
    expect(result.providerSessionId).toBe("resp_123");
    expect(onStdout).toHaveBeenCalledWith("hello from openai\n");
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerName: "openai",
        baseURL: "https://api.openai.com/v1",
        style: "responses",
        requestTimeoutMs: 120_000,
        model: "gpt-4.1-mini",
      })
    );
  });

  it("supports compatible base URL with chat completions path", async () => {
    const runtime = createRuntime(async () => ({
      text: "hello from compatible endpoint\n",
    }));
    const provider = new OpenAIProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      systemPrompt: "You are OpenGoat.",
      env: {
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "https://compatible.example/v1/",
        OPENAI_ENDPOINT_PATH: "/chat/completions",
        OPENAI_MODEL: "compatible-model",
      },
    });

    expect(result.code).toBe(0);
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://compatible.example/v1/",
        endpointPathOverride: "/chat/completions",
        style: "chat",
        requestTimeoutMs: 60_000,
        model: "compatible-model",
        message: "hello",
        systemPrompt: "You are OpenGoat.",
      })
    );
  });

  it("supports endpoint override precedence", async () => {
    const runtime = createRuntime(async () => ({
      text: "override endpoint\n",
    }));
    const provider = new OpenAIProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: {
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "https://ignored.example/v1",
        OPENAI_ENDPOINT: "https://override.example/custom/responses",
        OPENAI_MODEL: "custom-model",
      },
    });

    expect(result.code).toBe(0);
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://ignored.example/v1",
        endpointOverride: "https://override.example/custom/responses",
        style: "responses",
        requestTimeoutMs: 60_000,
        model: "custom-model",
      })
    );
  });

  it("retries with chat completions when responses flow returns 404", async () => {
    const runtime = createRuntime(async () => ({
      text: "fallback chat endpoint works\n",
    }));
    runtime.generateText
      .mockRejectedValueOnce({
        statusCode: 404,
        message: "Not Found",
      })
      .mockResolvedValueOnce({ text: "fallback chat endpoint works\n" });
    const provider = new OpenAIProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: {
        OPENAI_API_KEY: "test-key",
      },
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("fallback chat endpoint works\n");
    expect(runtime.generateText).toHaveBeenCalledTimes(2);

    const firstCall = runtime.generateText.mock
      .calls[0]?.[0] as OpenAiCompatibleTextRequest;
    expect(firstCall.style).toBe("responses");
    expect(firstCall.baseURL).toBe("https://api.openai.com/v1");
    expect(firstCall.endpointPathOverride).toBeUndefined();

    const secondCall = runtime.generateText.mock
      .calls[1]?.[0] as OpenAiCompatibleTextRequest;
    expect(secondCall.style).toBe("chat");
    expect(secondCall.endpointPathOverride).toBe("/chat/completions");
  });

  it("retries with chat completions when responses flow times out", async () => {
    const runtime = createRuntime(async () => ({
      text: "fallback chat endpoint works after timeout\n",
    }));
    runtime.generateText
      .mockRejectedValueOnce({
        message: "Request timed out after 20000ms",
      })
      .mockResolvedValueOnce({
        text: "fallback chat endpoint works after timeout\n",
      });
    const provider = new OpenAIProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: {
        OPENAI_API_KEY: "test-key",
      },
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("fallback chat endpoint works after timeout\n");
    expect(runtime.generateText).toHaveBeenCalledTimes(2);

    const firstCall = runtime.generateText.mock
      .calls[0]?.[0] as OpenAiCompatibleTextRequest;
    expect(firstCall.style).toBe("responses");

    const secondCall = runtime.generateText.mock
      .calls[1]?.[0] as OpenAiCompatibleTextRequest;
    expect(secondCall.style).toBe("chat");
    expect(secondCall.endpointPathOverride).toBe("/chat/completions");
  });

  it("supports OPENAI_BASE_URL and OPENAI_MODEL aliases", async () => {
    const runtime = createRuntime(async () => ({ text: "alias vars\n" }));
    const provider = new OpenAIProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: {
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "https://gateway.example/v1/",
        OPENAI_MODEL: "gateway-model",
      },
    });

    expect(result.code).toBe(0);
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://gateway.example/v1/",
        style: "chat",
        requestTimeoutMs: 60_000,
        model: "gateway-model",
      })
    );
  });

  it("honors OPENAI_REQUEST_TIMEOUT_MS override", async () => {
    const runtime = createRuntime(async () => ({ text: "custom timeout\n" }));
    const provider = new OpenAIProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: {
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "https://gateway.example/v1/",
        OPENAI_MODEL: "gateway-model",
        OPENAI_REQUEST_TIMEOUT_MS: "45000",
      },
    });

    expect(result.code).toBe(0);
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        requestTimeoutMs: 45_000,
      })
    );
  });

  it("requires explicit model for non-default base URLs", async () => {
    const runtime = createRuntime(async () => ({ text: "unused\n" }));
    const provider = new OpenAIProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: {
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "https://integrate.api.nvidia.com/v1",
      },
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "Missing model for OpenAI-compatible base URL"
    );
    expect(runtime.generateText).not.toHaveBeenCalled();
  });

  it("fails on malformed successful payload", async () => {
    const runtime = createRuntime(async () => {
      throw new ProviderRuntimeError(
        "openai",
        "no textual output found in response"
      );
    });
    const provider = new OpenAIProvider({ runtime });

    await expect(
      provider.invoke({ message: "hello", env: { OPENAI_API_KEY: "test-key" } })
    ).rejects.toThrow(ProviderRuntimeError);
  });

  it("requires API key and does not support auth action", async () => {
    const provider = new OpenAIProvider();

    await expect(
      provider.invoke({ message: "hello", env: {} })
    ).rejects.toThrow(ProviderAuthenticationError);
    expect(() => provider.invokeAuth()).toThrow(UnsupportedProviderActionError);
  });
});

function createRuntime(
  implementation: (
    request: OpenAiCompatibleTextRequest
  ) => Promise<{ text: string; providerSessionId?: string }>
): OpenAiCompatibleTextRuntime & { generateText: ReturnType<typeof vi.fn> } {
  const generateText = vi.fn(implementation);
  return {
    generateText,
  };
}
