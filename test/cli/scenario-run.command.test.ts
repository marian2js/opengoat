import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scenarioRunCommand } from "../../packages/cli/src/cli/commands/scenario-run.command.js";
import { removeTempDir } from "../helpers/temp-opengoat.js";
import { createStreamCapture } from "../helpers/stream-capture.js";

const roots: string[] = [];
const originalHome = process.env.OPENGOAT_HOME;

afterEach(async () => {
  if (originalHome === undefined) {
    delete process.env.OPENGOAT_HOME;
  } else {
    process.env.OPENGOAT_HOME = originalHome;
  }

  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("scenario run command", () => {
  it("validates required file argument", async () => {
    const { context, stderr } = createContext({
      initialize: async () => undefined,
      runAgent: async () => ({
        code: 0,
        stdout: "ok\n",
        stderr: "",
        agentId: "goat",
        providerId: "openclaw",
        entryAgentId: "goat",
        tracePath: "/tmp/trace.json"
      })
    });

    const code = await scenarioRunCommand.run([], context);
    expect(code).toBe(1);
    expect(stderr.output()).toContain("--file is required");
  });

  it("runs a live scenario with mocked service", async () => {
    const scenarioFile = await writeScenarioFile({
      name: "live test",
      message: "hello",
      assertions: {
        stdoutIncludes: ["done"]
      }
    });

    const { context, stdout } = createContext({
      initialize: async () => undefined,
      runAgent: async () => ({
        code: 0,
        stdout: "done\n",
        stderr: "",
        agentId: "goat",
        providerId: "openclaw",
        entryAgentId: "goat",
        tracePath: "/tmp/trace.json"
      })
    });

    const code = await scenarioRunCommand.run(["--file", scenarioFile], context);
    expect(code).toBe(0);
    expect(stdout.output()).toContain("Success: true");
  });

  it("runs scripted scenario mode end-to-end", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opengoat-scenario-scripted-"));
    roots.push(root);
    process.env.OPENGOAT_HOME = root;

    const scenarioFile = await writeScenarioFile({
      name: "scripted test",
      message: "build feature",
      agents: [
        { id: "worker", name: "Worker", description: "Does work" }
      ],
      scripted: {
        agentReplies: {
          goat: "Scenario complete",
          worker: "WORK DONE"
        }
      },
      assertions: {
        stdoutIncludes: ["Scenario complete"]
      }
    });

    const { context, stdout } = createContext({
      initialize: async () => undefined,
      runAgent: async () => {
        throw new Error("live service should not be used in scripted mode");
      }
    });
    const code = await scenarioRunCommand.run(["--file", scenarioFile, "--mode", "scripted"], context);
    expect(code).toBe(0);
    expect(stdout.output()).toContain("Mode: scripted");
    expect(stdout.output()).toContain("Success: true");
  });
});

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

async function writeScenarioFile(spec: Record<string, unknown>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "opengoat-scenario-file-"));
  roots.push(root);
  const filePath = path.join(root, "scenario.json");
  await writeFile(filePath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  return filePath;
}
