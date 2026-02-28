import { describe, expect, it } from "vitest";
import { OpenClawProvider, parseGatewayAgentResponse } from "./provider.js";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";

describe("openclaw provider", () => {
  class TestableOpenClawProvider extends OpenClawProvider {
    public exposePrepareExecutionEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
      return this.prepareExecutionEnv(env);
    }
  }

  it("maps invoke options", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      agent: "builder",
      model: "gpt-5",
      passthroughArgs: ["--full-auto"],
    });

    expect(invocation.command).toBe("openclaw");
    expect(invocation.args.slice(0, 3)).toEqual(["gateway", "call", "agent"]);
    expect(invocation.args).toContain("--expect-final");
    expect(invocation.args).toContain("--json");
    expect(invocation.args).toContain("--full-auto");

    const params = readGatewayParams(invocation.args);
    expect(params).toMatchObject({
      message: "ship",
      agentId: "builder",
      model: "gpt-5",
    });
    expect(typeof params.idempotencyKey).toBe("string");
  });

  it("uses provided idempotency key for gateway calls", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildInvocation({
      message: "ship",
      agent: "builder",
      idempotencyKey: "run-1234",
    });

    const params = readGatewayParams(invocation.args);
    expect(params).toMatchObject({
      message: "ship",
      idempotencyKey: "run-1234",
    });
  });

  it("maps auth invocation with and without passthrough args", () => {
    const provider = new OpenClawProvider();

    const defaultInvocation = provider.buildAuthInvocation({});
    expect(defaultInvocation.command).toBe("openclaw");
    expect(defaultInvocation.args).toEqual(["onboard"]);

    const passthroughInvocation = provider.buildAuthInvocation({
      passthroughArgs: ["--provider", "goat-model"],
    });
    expect(passthroughInvocation.args).toEqual([
      "models",
      "auth",
      "login",
      "--provider",
      "goat-model",
    ]);
  });

  it("maps OpenGoat session ids into OpenClaw session keys", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildInvocation({
      message: "continue",
      agent: "builder",
      providerSessionId: "claw-session-7",
    });

    const params = readGatewayParams(invocation.args);
    expect(params).toMatchObject({
      agentId: "builder",
      sessionId: "claw-session-7",
      sessionKey: "agent:builder:claw-session-7",
    });
  });

  it("keeps explicit OpenClaw session keys as-is", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildInvocation({
      message: "continue",
      agent: "goat",
      providerSessionId: "agent:goat:custom-key",
    });

    const params = readGatewayParams(invocation.args);
    expect(params).toMatchObject({
      sessionKey: "agent:goat:custom-key",
    });
  });

  it("maps external agent creation invocation to top-level agents add command", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildCreateAgentInvocation({
      agentId: "research-analyst",
      displayName: "Research Analyst",
      workspaceDir: "/tmp/workspaces/research-analyst",
      internalConfigDir: "/tmp/agents/research-analyst",
    });

    expect(provider.capabilities.agentCreate).toBe(true);
    expect(provider.capabilities.agentDelete).toBe(true);
    expect(provider.capabilities.reportees).toBe(true);
    expect(invocation.command).toBe("openclaw");
    expect(invocation.args).toEqual([
      "agents",
      "add",
      "research-analyst",
      "--workspace",
      "/tmp/workspaces/research-analyst",
      "--agent-dir",
      "/tmp/agents/research-analyst",
      "--non-interactive",
    ]);
  });

  it("passes configured OpenClaw model when creating external agents", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildCreateAgentInvocation({
      agentId: "research-analyst",
      displayName: "Research Analyst",
      workspaceDir: "/tmp/workspaces/research-analyst",
      internalConfigDir: "/tmp/agents/research-analyst",
      env: {
        OPENGOAT_OPENCLAW_MODEL: "goat-model",
      },
    });

    expect(invocation.args).toEqual([
      "agents",
      "add",
      "research-analyst",
      "--workspace",
      "/tmp/workspaces/research-analyst",
      "--agent-dir",
      "/tmp/agents/research-analyst",
      "--non-interactive",
      "--model",
      "goat-model",
    ]);
  });

  it("maps external agent deletion invocation to top-level agents delete command", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildDeleteAgentInvocation({
      agentId: "research-analyst",
    });

    expect(invocation.command).toBe("openclaw");
    expect(invocation.args).toEqual([
      "agents",
      "delete",
      "research-analyst",
      "--force",
    ]);
  });

  it("injects extra arguments from OPENCLAW_ARGUMENTS env var", () => {
    const provider = new OpenClawProvider();
    const invocation = provider.buildInvocation({
      message: "hello remote",
      env: {
        OPENCLAW_ARGUMENTS:
          "--profile team-a --remote ws://localhost:18789 --token secret",
      },
    });

    expect(invocation.args.slice(0, 5)).toEqual([
      "--profile",
      "team-a",
      "gateway",
      "call",
      "agent",
    ]);
    expect(invocation.args).toContain("--url");
    expect(invocation.args).toContain("ws://localhost:18789");
    expect(invocation.args).toContain("--token");
    expect(invocation.args).toContain("secret");
  });

  it("prepends OPENCLAW_ARGUMENTS for create/delete/auth commands", () => {
    const provider = new OpenClawProvider();
    const env = {
      OPENCLAW_ARGUMENTS: "--profile team-a",
    };

    const createInvocation = provider.buildCreateAgentInvocation({
      agentId: "research-analyst",
      displayName: "Research Analyst",
      workspaceDir: "/tmp/workspaces/research-analyst",
      internalConfigDir: "/tmp/agents/research-analyst",
      env,
    });
    expect(createInvocation.args.slice(0, 2)).toEqual(["--profile", "team-a"]);
    expect(createInvocation.args.slice(2, 5)).toEqual(["agents", "add", "research-analyst"]);

    const deleteInvocation = provider.buildDeleteAgentInvocation({
      agentId: "research-analyst",
      env,
    });
    expect(deleteInvocation.args.slice(0, 2)).toEqual(["--profile", "team-a"]);
    expect(deleteInvocation.args.slice(2, 5)).toEqual(["agents", "delete", "research-analyst"]);

    const authInvocation = provider.buildAuthInvocation({
      env,
    });
    expect(authInvocation.args.slice(0, 2)).toEqual(["--profile", "team-a"]);
    expect(authInvocation.args.slice(2)).toEqual(["onboard"]);
  });

  it("expands PATH to include common user npm/bin locations", () => {
    const provider = new TestableOpenClawProvider();
    const prepared = provider.exposePrepareExecutionEnv({
      PATH: "/usr/bin",
      npm_config_prefix: "/tmp/opengoat-prefix",
    });

    const entries = (prepared.PATH ?? "").split(delimiter);
    expect(entries).toContain(dirname(process.execPath));
    expect(entries).toContain(join(homedir(), ".npm-global", "bin"));
    expect(entries).toContain(join("/tmp/opengoat-prefix", "bin"));
    expect(entries).toContain("/usr/bin");
  });

  it("parses OpenClaw gateway final payload JSON into assistant text", () => {
    const parsed = parseGatewayAgentResponse(
      JSON.stringify({
        runId: "run-1",
        status: "ok",
        result: {
          payloads: [
            { text: "## Proposed Roadmap\nDay 1: Scope freeze." },
            { text: "### Confirmation\nIs this roadmap okay?" },
          ],
          meta: {
            agentMeta: {
              sessionId: "agent:goat:roadmap",
            },
          },
        },
      }),
    );

    expect(parsed).toEqual({
      assistantText:
        "## Proposed Roadmap\nDay 1: Scope freeze.\n\n### Confirmation\nIs this roadmap okay?",
      providerSessionId: "agent:goat:roadmap",
    });
  });

  it("parses OpenClaw gateway JSON even with non-JSON prelude text", () => {
    const parsed = parseGatewayAgentResponse(
      [
        "warning: stale config entry ignored",
        JSON.stringify({
          runId: "run-2",
          status: "ok",
          result: {
            payloads: [{ text: "Roadmap draft ready." }],
          },
        }),
      ].join("\n"),
    );

    expect(parsed?.assistantText).toBe("Roadmap draft ready.");
  });
});

function readGatewayParams(args: string[]): Record<string, unknown> {
  const index = args.indexOf("--params");
  expect(index).toBeGreaterThanOrEqual(0);
  const value = args[index + 1];
  expect(typeof value).toBe("string");
  return JSON.parse(value ?? "{}") as Record<string, unknown>;
}
