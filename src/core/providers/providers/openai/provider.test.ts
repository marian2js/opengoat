import { describe, expect, it, vi } from "vitest";
import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError
} from "../../errors.js";
import { OpenAIProvider } from "./provider.js";

describe("openai provider", () => {
  it("parses responses API output", async () => {
    const provider = new OpenAIProvider();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output_text: "hello from openai" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await withFetchMock(fetchMock, async () => {
      const result = await provider.invoke({
        message: "hello",
        env: { OPENAI_API_KEY: "test-key" }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("hello from openai\n");
    });
  });

  it("supports compatible base URL with chat completions", async () => {
    const provider = new OpenAIProvider();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "hello from compatible endpoint" } }]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    );

    await withFetchMock(fetchMock, async () => {
      const result = await provider.invoke({
        message: "hello",
        systemPrompt: "You are OpenGoat.",
        env: {
          OPENAI_API_KEY: "test-key",
          OPENAI_BASE_URL: "https://compatible.example/v1/",
          OPENAI_ENDPOINT_PATH: "/chat/completions",
          OPENAI_MODEL: "compatible-model"
        }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("hello from compatible endpoint\n");
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://compatible.example/v1/chat/completions");
    expect(JSON.parse(String(requestInit.body))).toEqual({
      model: "compatible-model",
      messages: [
        { role: "system", content: "You are OpenGoat." },
        { role: "user", content: "hello" }
      ]
    });
  });

  it("passes system prompt to responses API when provided", async () => {
    const provider = new OpenAIProvider();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output_text: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await withFetchMock(fetchMock, async () => {
      await provider.invoke({
        message: "hello",
        systemPrompt: "System rules.",
        env: { OPENAI_API_KEY: "test-key" }
      });
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toEqual({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: "System rules." },
        { role: "user", content: "hello" }
      ]
    });
  });

  it("supports endpoint override precedence", async () => {
    const provider = new OpenAIProvider();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output_text: "override endpoint" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await withFetchMock(fetchMock, async () => {
      const result = await provider.invoke({
        message: "hello",
        env: {
          OPENAI_API_KEY: "test-key",
          OPENAI_BASE_URL: "https://ignored.example/v1",
          OPENAI_ENDPOINT: "https://override.example/custom/responses",
          OPENAI_MODEL: "custom-model"
        }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("override endpoint\n");
    });

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://override.example/custom/responses");
  });

  it("retries with chat completions when responses endpoint returns 404", async () => {
    const provider = new OpenAIProvider();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("404 page not found", {
          status: 404,
          headers: { "Content-Type": "text/plain" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "fallback chat endpoint works" } }]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      );

    await withFetchMock(fetchMock, async () => {
      const result = await provider.invoke({
        message: "hello",
        env: {
          OPENAI_API_KEY: "test-key",
          OPENAI_BASE_URL: "https://integrate.api.nvidia.com/v1",
          OPENAI_MODEL: "meta/llama-3.1-8b-instruct"
        }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("fallback chat endpoint works\n");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [secondUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(firstUrl).toBe("https://integrate.api.nvidia.com/v1/responses");
    expect(secondUrl).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
  });

  it("supports OPENAI_BASE_URL and OPENAI_MODEL aliases", async () => {
    const provider = new OpenAIProvider();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output_text: "alias vars" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await withFetchMock(fetchMock, async () => {
      const result = await provider.invoke({
        message: "hello",
        env: {
          OPENAI_API_KEY: "test-key",
          OPENAI_BASE_URL: "https://gateway.example/v1/",
          OPENAI_MODEL: "gateway-model"
        }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("alias vars\n");
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://gateway.example/v1/responses");
    expect(JSON.parse(String(requestInit.body))).toEqual({
      model: "gateway-model",
      input: "hello"
    });
  });

  it("requires explicit model for non-default base URLs", async () => {
    const provider = new OpenAIProvider();
    const fetchMock = vi.fn();

    await withFetchMock(fetchMock, async () => {
      const result = await provider.invoke({
        message: "hello",
        env: {
          OPENAI_API_KEY: "test-key",
          OPENAI_BASE_URL: "https://integrate.api.nvidia.com/v1"
        }
      });

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Missing model for OpenAI-compatible base URL");
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails on malformed successful payload", async () => {
    const provider = new OpenAIProvider();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output_text: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await withFetchMock(fetchMock, async () => {
      await expect(
        provider.invoke({ message: "hello", env: { OPENAI_API_KEY: "test-key" } })
      ).rejects.toThrow(ProviderRuntimeError);
    });
  });

  it("requires API key and does not support auth action", async () => {
    const provider = new OpenAIProvider();

    await expect(provider.invoke({ message: "hello", env: {} })).rejects.toThrow(
      ProviderAuthenticationError
    );
    expect(() => provider.invokeAuth()).toThrow(UnsupportedProviderActionError);
  });
});

async function withFetchMock<T>(mock: typeof fetch, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = mock;

  try {
    return await run();
  } finally {
    (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
  }
}
