import { describe, expect, it, vi } from "vitest";
import { ProviderAuthenticationError } from "../../errors.js";
import { extendedHttpProviderCatalog } from "./catalog.js";
import { ExtendedHttpProvider } from "./provider.js";

describe("extended http provider", () => {
  it("invokes OpenAI-chat providers with bearer auth and normalized model id", async () => {
    const fetchFn = vi.fn(async () =>
      createJsonResponse({
        choices: [{ message: { content: "hello from groq" } }],
        id: "chatcmpl_1"
      })
    );

    const provider = new ExtendedHttpProvider(findSpec("groq"), {
      fetchFn
    });

    const result = await provider.invoke({
      message: "ping",
      model: "groq/llama-3.3-70b-versatile",
      env: {
        GROQ_API_KEY: "gsk_test"
      }
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("hello from groq\n");

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [endpoint, request] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(request.method).toBe("POST");

    const headers = request.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer gsk_test");

    const body = JSON.parse(String(request.body));
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.messages).toEqual([{ role: "user", content: "ping" }]);
  });

  it("invokes anthropic-compatible providers with x-api-key auth", async () => {
    const fetchFn = vi.fn(async () =>
      createJsonResponse({
        id: "msg_1",
        content: [{ type: "text", text: "hello from anthropic" }]
      })
    );

    const provider = new ExtendedHttpProvider(findSpec("anthropic"), {
      fetchFn
    });

    const result = await provider.invoke({
      message: "ping",
      systemPrompt: "You are helpful.",
      model: "anthropic/claude-opus-4-5",
      env: {
        ANTHROPIC_API_KEY: "ant-key"
      }
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("hello from anthropic\n");

    const [endpoint, request] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe("https://api.anthropic.com/v1/messages");

    const headers = request.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("ant-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");

    const payload = JSON.parse(String(request.body));
    expect(payload.model).toBe("claude-opus-4-5");
    expect(payload.system).toBe("You are helpful.");
  });

  it("supports providers with dynamic base URLs", async () => {
    const fetchFn = vi.fn(async () =>
      createJsonResponse({
        id: "msg_cf_1",
        content: [{ type: "text", text: "ok" }]
      })
    );

    const provider = new ExtendedHttpProvider(findSpec("cloudflare-ai-gateway"), {
      fetchFn
    });

    const result = await provider.invoke({
      message: "ping",
      env: {
        CLOUDFLARE_AI_GATEWAY_API_KEY: "cf-key",
        CLOUDFLARE_AI_GATEWAY_ACCOUNT_ID: "acc-1",
        CLOUDFLARE_AI_GATEWAY_GATEWAY_ID: "gw-2"
      }
    });

    expect(result.code).toBe(0);

    const [endpoint] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe("https://gateway.ai.cloudflare.com/v1/acc-1/gw-2/anthropic/v1/messages");
  });

  it("throws ProviderAuthenticationError when required auth is missing", async () => {
    const provider = new ExtendedHttpProvider(findSpec("openai-codex"), {
      fetchFn: vi.fn(async () => createJsonResponse({ choices: [{ message: { content: "unused" } }] }))
    });

    await expect(
      provider.invoke({
        message: "ping",
        env: {}
      })
    ).rejects.toBeInstanceOf(ProviderAuthenticationError);
  });

  it("invokes bedrock providers via BedrockRuntimeClient", async () => {
    const send = vi.fn(async () => ({
      output: {
        message: {
          content: [{ text: "bedrock ok" }]
        }
      },
      $metadata: {
        requestId: "req-1"
      }
    }));

    const provider = new ExtendedHttpProvider(findSpec("amazon-bedrock"), {
      createBedrockClient: () => ({ send })
    });

    const result = await provider.invoke({
      message: "ping",
      env: {
        AMAZON_BEDROCK_MODEL: "anthropic.claude-3-5-sonnet"
      }
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("bedrock ok\n");
    expect(send).toHaveBeenCalledTimes(1);
  });
});

function findSpec(providerId: string) {
  const spec = extendedHttpProviderCatalog.find((entry) => entry.id === providerId);
  if (!spec) {
    throw new Error(`Missing provider spec: ${providerId}`);
  }
  return spec;
}

function createJsonResponse(payload: unknown, init: { status?: number } = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json"
    }
  });
}
