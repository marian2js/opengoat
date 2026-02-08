import { describe, expect, it, vi } from "vitest";
import {
  VercelAiTextRuntime,
  parseLlmRuntimeError,
} from "./vercel-ai-text-runtime.js";

describe("VercelAiTextRuntime", () => {
  it("uses responses model style and exposes provider session id", async () => {
    const responsesModel = { id: "responses-model" };
    const chatModel = { id: "chat-model" };
    const provider = {
      responses: vi.fn(() => responsesModel),
      chat: vi.fn(() => chatModel),
    };
    const createOpenAIProvider = vi.fn(() => provider);
    const generateTextFn = vi.fn(async () => ({
      text: "hello",
      providerMetadata: {
        openai: {
          responseId: "resp_1",
        },
      },
    }));
    const runtime = new VercelAiTextRuntime({
      createOpenAIProvider: createOpenAIProvider as never,
      generateTextFn: generateTextFn as never,
    });

    const result = await runtime.generateText({
      providerName: "openai",
      apiKey: "sk-test",
      model: "gpt-5",
      message: "hello",
      baseURL: "https://api.openai.com/v1",
      style: "responses",
    });

    expect(provider.responses).toHaveBeenCalledWith("gpt-5");
    expect(provider.chat).not.toHaveBeenCalled();
    expect(generateTextFn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: responsesModel,
        prompt: "hello",
        maxRetries: 0,
      })
    );
    expect(result).toEqual({
      text: "hello\n",
      providerSessionId: "resp_1",
    });
  });

  it("uses chat model style", async () => {
    const responsesModel = { id: "responses-model" };
    const chatModel = { id: "chat-model" };
    const provider = {
      responses: vi.fn(() => responsesModel),
      chat: vi.fn(() => chatModel),
    };
    const runtime = new VercelAiTextRuntime({
      createOpenAIProvider: vi.fn(() => provider) as never,
      generateTextFn: vi.fn(async () => ({ text: "chat output" })) as never,
    });

    const result = await runtime.generateText({
      providerName: "openrouter",
      apiKey: "sk-test",
      model: "openai/gpt-4o-mini",
      message: "hi",
      baseURL: "https://openrouter.ai/api/v1",
      style: "chat",
    });

    expect(provider.chat).toHaveBeenCalledWith("openai/gpt-4o-mini");
    expect(provider.responses).not.toHaveBeenCalled();
    expect(result.text).toBe("chat output\n");
  });

  it("builds fetch middleware for endpoint override and path rewrite", async () => {
    const provider = {
      responses: vi.fn(() => ({ id: "responses-model" })),
      chat: vi.fn(() => ({ id: "chat-model" })),
    };
    const createOpenAIProvider = vi.fn(() => provider);
    const generateTextFn = vi.fn(async () => ({ text: "ok" }));
    const fetchFn = vi.fn(async () => new Response("ok", { status: 200 }));

    const runtime = new VercelAiTextRuntime({
      createOpenAIProvider: createOpenAIProvider as never,
      generateTextFn: generateTextFn as never,
      fetchFn: fetchFn as never,
    });

    await runtime.generateText({
      providerName: "openai",
      apiKey: "sk-test",
      model: "gpt-5",
      message: "hello",
      baseURL: "https://api.openai.com/v1",
      style: "responses",
      endpointOverride: "https://override.example/custom/responses",
    });

    const firstFetch = createOpenAIProvider.mock.calls[0]?.[0]?.fetch as
      | ((input: string, init?: RequestInit) => Promise<Response>)
      | undefined;
    expect(firstFetch).toBeTypeOf("function");
    await firstFetch?.("https://api.openai.com/v1/responses");
    expect(fetchFn).toHaveBeenLastCalledWith(
      "https://override.example/custom/responses",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );

    await runtime.generateText({
      providerName: "openai",
      apiKey: "sk-test",
      model: "gpt-5",
      message: "hello",
      baseURL: "https://api.openai.com/v1",
      style: "responses",
      endpointPathOverride: "/chat/completions",
    });

    const secondFetch = createOpenAIProvider.mock.calls[1]?.[0]?.fetch as
      | ((input: string, init?: RequestInit) => Promise<Response>)
      | undefined;
    expect(secondFetch).toBeTypeOf("function");
    await secondFetch?.("https://api.openai.com/v1/responses?x=1");
    expect(fetchFn).toHaveBeenLastCalledWith(
      "https://api.openai.com/v1/chat/completions?x=1",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("times out stalled fetch requests", async () => {
    const provider = {
      responses: vi.fn(() => ({ id: "responses-model" })),
      chat: vi.fn(() => ({ id: "chat-model" })),
    };
    const createOpenAIProvider = vi.fn(() => provider);
    const fetchFn = vi.fn(() => new Promise<Response>(() => {}));
    const runtime = new VercelAiTextRuntime({
      createOpenAIProvider: createOpenAIProvider as never,
      generateTextFn: vi.fn(async () => ({ text: "ok" })) as never,
      fetchFn: fetchFn as never,
      requestTimeoutMs: 5,
    });

    await runtime.generateText({
      providerName: "openai",
      apiKey: "sk-test",
      model: "gpt-5",
      message: "hello",
      baseURL: "https://api.openai.com/v1",
      style: "responses",
    });

    const middlewareFetch = createOpenAIProvider.mock.calls[0]?.[0]?.fetch as
      | ((input: string, init?: RequestInit) => Promise<Response>)
      | undefined;
    expect(middlewareFetch).toBeTypeOf("function");
    if (!middlewareFetch) {
      throw new Error("Expected runtime fetch middleware.");
    }

    await expect(
      middlewareFetch("https://api.openai.com/v1/responses")
    ).rejects.toThrow("Request timed out after 5ms");
  });
});

describe("parseLlmRuntimeError", () => {
  it("formats status and response body", () => {
    const details = parseLlmRuntimeError({
      statusCode: 400,
      responseBody: '{"error":"bad_request"}',
    });

    expect(details).toEqual({
      statusCode: 400,
      message: 'HTTP 400: {"error":"bad_request"}',
    });
  });

  it("falls back to generic message", () => {
    const details = parseLlmRuntimeError(undefined);
    expect(details.message).toBe("LLM runtime request failed");
  });
});
