import { describe, expect, it, vi } from "vitest";
import type { OpenAiCompatibleTextRequest, OpenAiCompatibleTextRuntime } from "../../../llm/index.js";
import {
  ProviderAuthenticationError,
  ProviderRuntimeError,
  UnsupportedProviderActionError
} from "../../errors.js";
import { GrokProvider } from "./provider.js";

describe("grok provider", () => {
  it("parses responses API output from runtime", async () => {
    const runtime = createRuntime(async () => ({ text: "hello from grok\n" }));
    const provider = new GrokProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: { XAI_API_KEY: "test-key" }
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("hello from grok\n");
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerName: "grok",
        baseURL: "https://api.x.ai/v1",
        style: "responses",
        model: "grok-4"
      })
    );
  });

  it("supports chat completions endpoint via base URL and path overrides", async () => {
    const runtime = createRuntime(async () => ({ text: "hello from chat completions\n" }));
    const provider = new GrokProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: {
        XAI_API_KEY: "test-key",
        GROK_BASE_URL: "https://api.x.ai/v1/",
        GROK_ENDPOINT_PATH: "/chat/completions"
      }
    });

    expect(result.code).toBe(0);
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://api.x.ai/v1/",
        endpointPathOverride: "/chat/completions",
        style: "chat"
      })
    );
  });

  it("supports endpoint override precedence", async () => {
    const runtime = createRuntime(async () => ({ text: "override endpoint\n" }));
    const provider = new GrokProvider({ runtime });

    const result = await provider.invoke({
      message: "hello",
      env: {
        XAI_API_KEY: "test-key",
        GROK_BASE_URL: "https://ignored.example/v1",
        GROK_ENDPOINT: "https://override.example/custom/responses"
      }
    });

    expect(result.code).toBe(0);
    expect(runtime.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        endpointOverride: "https://override.example/custom/responses",
        baseURL: "https://ignored.example/v1"
      })
    );
  });

  it("forwards image inputs to the runtime", async () => {
    const runtime = createRuntime(async () => ({ text: "image reply\n" }));
    const provider = new GrokProvider({ runtime });

    const result = await provider.invoke({
      message: "Describe this",
      images: [
        {
          dataUrl: "data:image/png;base64,aGVsbG8="
        }
      ],
      env: {
        XAI_API_KEY: "test-key"
      }
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

  it("fails on malformed successful payload", async () => {
    const runtime = createRuntime(async () => {
      throw new ProviderRuntimeError("grok", "no textual output found in response");
    });
    const provider = new GrokProvider({ runtime });

    await expect(
      provider.invoke({ message: "hello", env: { XAI_API_KEY: "test-key" } })
    ).rejects.toThrow(ProviderRuntimeError);
  });

  it("requires API key and does not support auth action", async () => {
    const provider = new GrokProvider();

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
