import { describe, expect, it, vi } from "vitest";
import { onboardCommand } from "../../packages/cli/src/cli/commands/onboard.command.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

function createContext(service: unknown) {
  const stdout = createStreamCapture();
  const stderr = createStreamCapture();

  return {
    context: {
      service: service as never,
      stdout: stdout.stream,
      stderr: stderr.stream
    },
    stdout,
    stderr
  };
}

describe("onboard command", () => {
  it("prints help", async () => {
    const service = {
      initialize: vi.fn(),
      setOpenClawGatewayConfig: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context, stdout } = createContext(service);
    const code = await onboardCommand.run(["--help"], context);

    expect(code).toBe(0);
    expect(stdout.output()).toContain("Usage:");
    expect(stdout.output()).toContain("opengoat onboard");
  });

  it("defaults to local gateway in non-interactive mode", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      setOpenClawGatewayConfig: vi.fn(async () => ({ mode: "local" })),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context, stdout } = createContext(service);
    const code = await onboardCommand.run(["--non-interactive"], context);

    expect(code).toBe(0);
    expect(service.initialize).toHaveBeenCalledOnce();
    expect(service.setOpenClawGatewayConfig).toHaveBeenCalledWith({ mode: "local" });
    expect(stdout.output()).toContain("Mode: local");
    expect(stdout.output()).toContain("/tmp/providers/openclaw/config.json");
  });

  it("configures external gateway in non-interactive mode", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      setOpenClawGatewayConfig: vi.fn(async () => ({
        mode: "external",
        gatewayUrl: "ws://remote-host:18789",
        gatewayToken: "secret-token"
      })),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context, stdout } = createContext(service);
    const code = await onboardCommand.run(
      [
        "--non-interactive",
        "--external",
        "--gateway-url",
        "ws://remote-host:18789",
        "--gateway-token",
        "secret-token"
      ],
      context
    );

    expect(code).toBe(0);
    expect(service.setOpenClawGatewayConfig).toHaveBeenCalledWith({
      mode: "external",
      gatewayUrl: "ws://remote-host:18789",
      gatewayToken: "secret-token"
    });
    expect(stdout.output()).toContain("Mode: external");
    expect(stdout.output()).toContain("Gateway URL: ws://remote-host:18789");
  });

  it("fails when external mode is missing gateway details", async () => {
    const service = {
      initialize: vi.fn(async () => ({})),
      setOpenClawGatewayConfig: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context, stderr } = createContext(service);
    const code = await onboardCommand.run(["--non-interactive", "--external"], context);

    expect(code).toBe(1);
    expect(stderr.output()).toContain("External mode requires --gateway-url and --gateway-token.");
    expect(service.setOpenClawGatewayConfig).not.toHaveBeenCalled();
  });

  it("rejects gateway URL/token flags when local mode is selected", async () => {
    const service = {
      initialize: vi.fn(),
      setOpenClawGatewayConfig: vi.fn(),
      getPaths: vi.fn(() => ({ providersDir: "/tmp/providers" }))
    };

    const { context, stderr } = createContext(service);
    const code = await onboardCommand.run(
      ["--local", "--gateway-url", "ws://remote-host:18789"],
      context
    );

    expect(code).toBe(1);
    expect(stderr.output()).toContain("--gateway-url/--gateway-token are only valid with --external.");
    expect(service.initialize).not.toHaveBeenCalled();
  });
});
