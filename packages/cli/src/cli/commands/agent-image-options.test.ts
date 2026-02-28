import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { OpenGoatService } from "@opengoat/core";
import { agentCommand } from "./agent.command.js";
import { agentRunCommand } from "./agent-run.command.js";

describe("agent image options", () => {
  it("forwards --image values from `agent` command", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "ok\n",
      stderr: "",
      agentId: "goat",
      providerId: "openclaw"
    }));

    const exitCode = await agentCommand.run(
      ["--message", "describe image", "--image", "./diagram.png", "--image", "./chart.jpg"],
      createContext(runAgent)
    );

    expect(exitCode).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "goat",
      expect.objectContaining({
        message: "describe image",
        images: [{ path: "./diagram.png" }, { path: "./chart.jpg" }]
      })
    );
  });

  it("forwards --image values from `agent run` command", async () => {
    const runAgent = vi.fn(async () => ({
      code: 0,
      stdout: "ok\n",
      stderr: "",
      agentId: "writer",
      providerId: "openclaw"
    }));

    const exitCode = await agentRunCommand.run(
      ["writer", "--message", "describe image", "--image", "./diagram.png"],
      createContext(runAgent)
    );

    expect(exitCode).toBe(0);
    expect(runAgent).toHaveBeenCalledWith(
      "writer",
      expect.objectContaining({
        message: "describe image",
        images: [{ path: "./diagram.png" }]
      })
    );
  });

  it("returns validation error when --image is missing a value", async () => {
    const runAgent = vi.fn();
    const exitCode = await agentCommand.run(
      ["--message", "describe", "--image"],
      createContext(runAgent)
    );

    expect(exitCode).toBe(1);
    expect(runAgent).not.toHaveBeenCalled();
  });
});

function createContext(runAgent: ReturnType<typeof vi.fn>) {
  const service = {
    runAgent
  } as unknown as OpenGoatService;

  return {
    service,
    stdout: new PassThrough(),
    stderr: new PassThrough()
  };
}
