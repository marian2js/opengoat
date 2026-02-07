import { describe, expect, it, vi } from "vitest";
import { acpCommand } from "../../src/apps/cli/commands/acp.command.js";
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

describe("acp command", () => {
  it("prints help output", async () => {
    const { context, stdout } = createContext({});
    const code = await acpCommand.run(["--help"], context);

    expect(code).toBe(0);
    expect(stdout.output()).toContain("opengoat acp");
    expect(stdout.output()).toContain("--agent");
  });

  it("validates option values", async () => {
    const initialize = vi.fn();
    const { context, stderr } = createContext({ initialize });

    const code = await acpCommand.run(["--history-limit", "0"], context);

    expect(code).toBe(1);
    expect(stderr.output()).toContain("Invalid value for --history-limit");
    expect(initialize).not.toHaveBeenCalled();
  });
});
