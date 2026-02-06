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
        env: {
          OPENAI_API_KEY: "test-key",
          OPENGOAT_OPENAI_BASE_URL: "https://compatible.example/v1/",
          OPENGOAT_OPENAI_ENDPOINT_PATH: "/chat/completions"
        }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("hello from compatible endpoint\n");
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://compatible.example/v1/chat/completions");
    expect(JSON.parse(String(requestInit.body))).toEqual({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "hello" }]
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
          OPENGOAT_OPENAI_BASE_URL: "https://ignored.example/v1",
          OPENGOAT_OPENAI_ENDPOINT: "https://override.example/custom/responses"
        }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("override endpoint\n");
    });

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://override.example/custom/responses");
  });

  it("supports OPENGOAT_OPENAI_API_KEY fallback", async () => {
    const provider = new OpenAIProvider();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output_text: "fallback key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await withFetchMock(fetchMock, async () => {
      const result = await provider.invoke({
        message: "hello",
        env: { OPENGOAT_OPENAI_API_KEY: "fallback-key" }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("fallback key\n");
    });
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
