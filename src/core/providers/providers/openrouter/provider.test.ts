import { describe, expect, it, vi } from "vitest";
import {
  ProviderAuthenticationError,
  UnsupportedProviderActionError
} from "../../errors.js";
import { OpenRouterProvider } from "./provider.js";

describe("openrouter provider", () => {
  it("parses string content response", async () => {
    const provider = new OpenRouterProvider();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "hello from openrouter" } }]
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
        env: { OPENROUTER_API_KEY: "test-key" }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("hello from openrouter\n");
    });
  });

  it("parses content arrays and forwards optional headers", async () => {
    const provider = new OpenRouterProvider();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: [{ type: "text", text: "hello from array content" }]
              }
            }
          ]
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
          OPENROUTER_API_KEY: "test-key",
          OPENGOAT_OPENROUTER_HTTP_REFERER: "https://example.test",
          OPENGOAT_OPENROUTER_X_TITLE: "OpenGoat"
        }
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toBe("hello from array content\n");
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestInit.headers).toEqual(
      expect.objectContaining({
        "HTTP-Referer": "https://example.test",
        "X-Title": "OpenGoat"
      })
    );
  });

  it("requires API key and does not support auth action", async () => {
    const provider = new OpenRouterProvider();

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
