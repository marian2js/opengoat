import { describe, expect, it, vi } from "vitest";
import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError
} from "../../errors.js";
import { GrokProvider } from "./provider.js";

describe("grok provider", () => {
  it("parses responses API output", async () => {
    const provider = new GrokProvider();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output_text: "hello from grok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await withFetchMock(fetchMock, async () => {
      const result = await provider.invoke({
        message: "hello",
        env: { XAI_API_KEY: "test-key" }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("hello from grok\n");
    });
  });

  it("supports chat completions endpoint via base URL and path overrides", async () => {
    const provider = new GrokProvider();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "hello from chat completions" } }]
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
          XAI_API_KEY: "test-key",
          OPENGOAT_GROK_BASE_URL: "https://api.x.ai/v1/",
          OPENGOAT_GROK_ENDPOINT_PATH: "/chat/completions"
        }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("hello from chat completions\n");
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://api.x.ai/v1/chat/completions");
    expect(JSON.parse(String(requestInit.body))).toEqual({
      model: "grok-4",
      messages: [{ role: "user", content: "hello" }]
    });
  });

  it("supports endpoint override precedence", async () => {
    const provider = new GrokProvider();
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
          XAI_API_KEY: "test-key",
          OPENGOAT_GROK_BASE_URL: "https://ignored.example/v1",
          OPENGOAT_GROK_ENDPOINT: "https://override.example/custom/responses"
        }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("override endpoint\n");
    });

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://override.example/custom/responses");
  });

  it("supports OPENGOAT_GROK_API_KEY fallback", async () => {
    const provider = new GrokProvider();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output_text: "fallback key" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await withFetchMock(fetchMock, async () => {
      const result = await provider.invoke({
        message: "hello",
        env: { OPENGOAT_GROK_API_KEY: "fallback-key" }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("fallback key\n");
    });
  });

  it("fails on malformed successful payload", async () => {
    const provider = new GrokProvider();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ output_text: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    await withFetchMock(fetchMock, async () => {
      await expect(
        provider.invoke({ message: "hello", env: { XAI_API_KEY: "test-key" } })
      ).rejects.toThrow(ProviderRuntimeError);
    });
  });

  it("requires API key and does not support auth action", async () => {
    const provider = new GrokProvider();

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
