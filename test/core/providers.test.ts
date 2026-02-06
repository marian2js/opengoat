import { describe, expect, it, vi } from "vitest";
import {
  BaseProvider,
  ClaudeProvider,
  CodexProvider,
  CursorProvider,
  OpenAIProvider,
  OpenClawProvider,
  OpenRouterProvider,
  ProviderRegistry,
  ProviderRuntimeError,
  UnsupportedProviderOptionError,
  createDefaultProviderRegistry
} from "../../src/core/providers/index.js";
import type {
  ProviderCapabilities,
  ProviderExecutionResult,
  ProviderInvokeOptions,
  ProviderKind
} from "../../src/core/providers/types.js";

describe("provider registry", () => {
  it("lists and creates built-in providers", () => {
    const registry = createDefaultProviderRegistry();

    expect(registry.listProviderIds()).toEqual([
      "claude",
      "codex",
      "cursor",
      "openai",
      "openclaw",
      "openrouter"
    ]);

    expect(registry.create("codex").id).toBe("codex");
    expect(registry.create("openrouter").kind).toBe("http");
  });

  it("allows custom provider registration", async () => {
    const registry = new ProviderRegistry();
    registry.register("mock", () => new MockProvider());

    const provider = registry.create("mock");
    const result = await provider.invoke({ message: "ping" });

    expect(provider.id).toBe("mock");
    expect(result.stdout).toContain("ping");
  });
});

describe("cli provider invocations", () => {
  it("maps codex options to codex exec invocation", () => {
    const provider = new CodexProvider();
    const invocation = provider.buildInvocation({
      message: "ping",
      model: "o3",
      passthroughArgs: ["--color", "never"]
    });

    expect(invocation.command).toBe("codex");
    expect(invocation.args).toEqual([
      "exec",
      "--skip-git-repo-check",
      "--model",
      "o3",
      "--color",
      "never",
      "ping"
    ]);
  });

  it("maps claude options including agent/model", () => {
    const provider = new ClaudeProvider();
    const invocation = provider.buildInvocation({
      message: "implement feature",
      agent: "planner",
      model: "sonnet",
      passthroughArgs: ["--max-tokens", "2048"]
    });

    expect(invocation.command).toBe("claude");
    expect(invocation.args).toEqual([
      "--print",
      "--agent",
      "planner",
      "--model",
      "sonnet",
      "--max-tokens",
      "2048",
      "implement feature"
    ]);
  });

  it("maps cursor through cursor agent wrapper by default", () => {
    const provider = new CursorProvider();
    const invocation = provider.buildInvocation({ message: "summarize repo" });

    expect(invocation.command).toBe("cursor");
    expect(invocation.args).toEqual(["agent", "summarize repo"]);
  });

  it("supports direct cursor-agent override", () => {
    const provider = new CursorProvider();
    const invocation = provider.buildInvocation(
      { message: "summarize repo" },
      { ...process.env, OPENGOAT_CURSOR_CMD: "cursor-agent" }
    );

    expect(invocation.command).toBe("cursor-agent");
    expect(invocation.args).toEqual(["summarize repo"]);
  });

  it("maps openclaw invocation", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      agent: "builder",
      model: "gpt-5",
      passthroughArgs: ["--full-auto"]
    });

    expect(invocation.command).toBe("openclaw");
    expect(invocation.args).toEqual([
      "agent",
      "builder",
      "--model",
      "gpt-5",
      "--full-auto",
      "--message",
      "ship"
    ]);
  });

  it("rejects unsupported options", () => {
    const provider = new CursorProvider();

    expect(() => provider.buildInvocation({ message: "hi", model: "gpt-5" })).toThrow(
      UnsupportedProviderOptionError
    );
  });
});

describe("http providers", () => {
  it("openai returns parsed output text", async () => {
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

  it("openrouter returns parsed choice content", async () => {
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

  it("openai supports OpenAI-compatible base URL and chat completions path", async () => {
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe("https://compatible.example/v1/chat/completions");
    expect(JSON.parse(String(requestInit.body))).toEqual({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: "hello" }]
    });
  });

  it("openai endpoint override takes precedence over base URL", async () => {
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

  it("openai throws on malformed successful payload", async () => {
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
});

class MockProvider extends BaseProvider {
  public readonly kind: ProviderKind = "cli";
  public readonly capabilities: ProviderCapabilities = {
    agent: false,
    model: false,
    auth: false,
    passthrough: false
  };

  public constructor() {
    super({
      id: "mock",
      displayName: "Mock",
      kind: "cli",
      capabilities: {
        agent: false,
        model: false,
        auth: false,
        passthrough: false
      }
    });
  }

  public async invoke(options: ProviderInvokeOptions): Promise<ProviderExecutionResult> {
    this.validateInvokeOptions(options);
    return {
      code: 0,
      stdout: `mock:${options.message}\n`,
      stderr: ""
    };
  }
}

async function withFetchMock<T>(mock: typeof fetch, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = mock;

  try {
    return await run();
  } finally {
    (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
  }
}
