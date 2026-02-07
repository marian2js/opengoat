import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scenarioRunCommand } from "../../src/apps/cli/commands/scenario-run.command.js";
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
        agentId: "orchestrator",
        providerId: "openai",
        entryAgentId: "orchestrator",
        routing: {
          entryAgentId: "orchestrator",
          targetAgentId: "orchestrator",
          confidence: 1,
          reason: "test",
          rewrittenMessage: "",
          candidates: []
        },
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
        agentId: "orchestrator",
        providerId: "openai",
        entryAgentId: "orchestrator",
        routing: {
          entryAgentId: "orchestrator",
          targetAgentId: "orchestrator",
          confidence: 1,
          reason: "test",
          rewrittenMessage: "",
          candidates: []
        },
        tracePath: "/tmp/trace.json",
        orchestration: {
          mode: "ai-loop",
          finalMessage: "done",
          steps: [],
          sessionGraph: { nodes: [], edges: [] }
        }
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
        orchestratorActions: [
          {
            rationale: "delegate",
            action: {
              type: "delegate_to_agent",
              mode: "hybrid",
              targetAgentId: "worker",
              message: "Do work",
              expectedOutput: "Work result"
            }
          },
          {
            rationale: "finish",
            action: {
              type: "finish",
              mode: "direct",
              message: "Scenario complete"
            }
          }
        ],
        agentReplies: {
          worker: "WORK DONE"
        }
      },
      assertions: {
        delegatedAgents: ["worker"],
        stdoutIncludes: ["Scenario complete"],
        minSteps: 2
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
