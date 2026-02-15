import { describe, expect, it } from "vitest";
import { shouldRegisterOpenGoatToolsForArgv } from "./invocation.js";

describe("shouldRegisterOpenGoatToolsForArgv", () => {
  it("returns true when startup explicitly forces registration", () => {
    expect(
      shouldRegisterOpenGoatToolsForArgv(
        ["node", "openclaw", "config", "get", "plugins.load.paths"],
        { OPENGOAT_OPENCLAW_REGISTER_TOOLS: "1" },
      ),
    ).toBe(true);
  });

  it("returns true for gateway call agent invocations", () => {
    expect(
      shouldRegisterOpenGoatToolsForArgv([
        "node",
        "openclaw",
        "gateway",
        "call",
        "agent",
      ]),
    ).toBe(true);
  });

  it("returns true for gateway lifecycle invocations", () => {
    expect(
      shouldRegisterOpenGoatToolsForArgv([
        "node",
        "openclaw",
        "gateway",
        "restart",
      ]),
    ).toBe(true);
  });

  it("returns true for LaunchAgent gateway process startup", () => {
    expect(
      shouldRegisterOpenGoatToolsForArgv(
        ["openclaw-gateway"],
        {
          OPENCLAW_GATEWAY_PORT: "18789",
          OPENCLAW_GATEWAY_TOKEN: "token",
        },
      ),
    ).toBe(true);
  });

  it("returns true for service-marked gateway daemon processes", () => {
    expect(
      shouldRegisterOpenGoatToolsForArgv(
        ["node", "/path/to/openclaw/dist/index.js"],
        {
          OPENCLAW_SERVICE_KIND: "gateway",
          OPENCLAW_SERVICE_MARKER: "openclaw",
        },
      ),
    ).toBe(true);
  });

  it("returns false for non-gateway invocations even with gateway env vars", () => {
    expect(
      shouldRegisterOpenGoatToolsForArgv(
        ["node", "openclaw", "plugins", "list"],
        {
          OPENCLAW_GATEWAY_PORT: "18789",
          OPENCLAW_GATEWAY_TOKEN: "token",
        },
      ),
    ).toBe(false);
  });

  it("returns true when gateway call agent has global flags", () => {
    expect(
      shouldRegisterOpenGoatToolsForArgv([
        "node",
        "openclaw",
        "--profile",
        "team-a",
        "gateway",
        "call",
        "agent",
      ]),
    ).toBe(true);
  });

  it("returns true for openclaw opengoat start", () => {
    expect(
      shouldRegisterOpenGoatToolsForArgv([
        "node",
        "openclaw",
        "opengoat",
        "start",
      ]),
    ).toBe(true);
    expect(
      shouldRegisterOpenGoatToolsForArgv([
        "node",
        "openclaw",
        "opengoat",
        "--",
        "start",
      ]),
    ).toBe(true);
  });

  it("returns false for non-runtime OpenClaw invocations", () => {
    expect(shouldRegisterOpenGoatToolsForArgv(["node", "openclaw"])).toBe(
      false,
    );
    expect(
      shouldRegisterOpenGoatToolsForArgv(["node", "openclaw", "--help"]),
    ).toBe(false);
    expect(
      shouldRegisterOpenGoatToolsForArgv([
        "node",
        "openclaw",
        "agents",
        "list",
      ]),
    ).toBe(false);
    expect(
      shouldRegisterOpenGoatToolsForArgv([
        "node",
        "openclaw",
        "opengoat",
        "agent",
        "list",
      ]),
    ).toBe(false);
  });
});
