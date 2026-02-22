import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) {
      await removeTempDir(root);
    }
  }
});

describe("CLI full e2e smoke", () => {
  it("covers core CLI workflows end-to-end", { timeout: 120000 }, async () => {
    const root = await createTempDir("opengoat-full-cli-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    await mkdir(opengoatHome, { recursive: true });
    const scenarioPath = await writeScenarioFixture(root);
    const skillSourcePath = await writeSkillFixture(root);
    const { stubPath, stubLogPath } = await createOpenClawStub(root);

    const env: NodeJS.ProcessEnv = {
      OPENCLAW_CMD: stubPath,
      OPENGOAT_OPENCLAW_CMD: stubPath,
      OPENCLAW_STUB_LOG: stubLogPath,
    };

    await expectOk(
      await runBinary(["init"], opengoatHome, env),
      "Default agent: ceo",
    );
    await expectOk(
      await runBinary(
        ["onboard", "--non-interactive", "--local"],
        opengoatHome,
        env,
      ),
      "Mode: local",
    );

    await expectOk(
      await runBinary(["agent", "--help"], opengoatHome, env),
      "Usage:",
    );
    await expectOk(
      await runBinary(["session", "--help"], opengoatHome, env),
      "session <command>",
    );
    await expectOk(
      await runBinary(["skill", "--help"], opengoatHome, env),
      "skill list",
    );
    await expectOk(
      await runBinary(["provider", "--help"], opengoatHome, env),
      "provider list",
    );
    await expectOk(
      await runBinary(["scenario", "--help"], opengoatHome, env),
      "scenario run",
    );
    await expectOk(
      await runBinary(["acp", "--help"], opengoatHome, env),
      "opengoat acp",
    );

    await expectOk(
      await runBinary(
        ["route", "--message", "Need API implementation support"],
        opengoatHome,
        env,
      ),
      "Routing decision",
    );
    await expectOk(
      await runBinary(
        ["agent", "create", "Developer", "--individual", "--skill", "coding"],
        opengoatHome,
        env,
      ),
      "Agent ready: Developer (developer)",
    );
    await expectOk(
      await runBinary(["agent", "list"], opengoatHome, env),
      "developer",
    );
    await expectOk(
      await runBinary(
        ["agent", "set-manager", "developer", "ceo"],
        opengoatHome,
        env,
      ),
      "Current reports-to: ceo",
    );

    await expectOk(
      await runBinary(
        [
          "agent",
          "run",
          "developer",
          "--message",
          "Implement a REST endpoint",
          "--no-stream",
        ],
        opengoatHome,
        env,
      ),
      "stub-agent-reply",
    );
    await expectOk(
      await runBinary(
        [
          "agent",
          "developer",
          "--message",
          "Summarize progress",
          "--no-stream",
        ],
        opengoatHome,
        env,
      ),
      "stub-agent-reply",
    );
    await expectOk(
      await runBinary(
        ["agent", "set-default", "developer"],
        opengoatHome,
        env,
      ),
      "Default agent: developer",
    );
    const updatedConfig = JSON.parse(
      await readFile(path.join(opengoatHome, "config.json"), "utf-8"),
    ) as { defaultAgent: string };
    expect(updatedConfig.defaultAgent).toBe("developer");
    await expectOk(
      await runBinary(["session", "list"], opengoatHome, env),
      "agent:developer:main",
    );

    await expectOk(
      await runBinary(
        ["session", "list", "--agent", "developer"],
        opengoatHome,
        env,
      ),
      "agent:developer:main",
    );
    await expectOk(
      await runBinary(
        ["session", "history", "--agent", "developer", "--limit", "5"],
        opengoatHome,
        env,
      ),
      "Session key: agent:developer:main",
    );
    await expectOk(
      await runBinary(
        [
          "session",
          "rename",
          "--agent",
          "developer",
          "--title",
          "Developer Session",
        ],
        opengoatHome,
        env,
      ),
      "Renamed session",
    );
    await expectOk(
      await runBinary(
        ["session", "compact", "--agent", "developer"],
        opengoatHome,
        env,
      ),
      "Compaction",
    );
    await expectOk(
      await runBinary(
        ["session", "reset", "--agent", "developer"],
        opengoatHome,
        env,
      ),
      "Reset session",
    );
    await expectOk(
      await runBinary(
        ["session", "remove", "--agent", "developer"],
        opengoatHome,
        env,
      ),
      "Removed session",
    );

    await expectOk(
      await runBinary(
        [
          "skill",
          "install",
          "helper",
          "--agent",
          "ceo",
          "--from",
          skillSourcePath,
        ],
        opengoatHome,
        env,
      ),
      "Installed skill: helper",
    );
    await expectOk(
      await runBinary(["skill", "list", "--agent", "ceo"], opengoatHome, env),
      "helper",
    );
    await expectOk(
      await runBinary(["skill", "list", "--global"], opengoatHome, env),
      "No skills installed.",
    );

    await expectOk(
      await runBinary(["provider", "list"], opengoatHome, env),
      "claude-code",
    );
    await expectOk(
      await runBinary(["provider", "list"], opengoatHome, env),
      "openclaw",
    );
    await expectOk(
      await runBinary(["agent", "provider", "get", "ceo"], opengoatHome, env),
      "ceo: openclaw",
    );
    await expectOk(
      await runBinary(
        ["agent", "provider", "set", "ceo", "openclaw"],
        opengoatHome,
        env,
      ),
      "ceo: openclaw",
    );

    await expectOk(
      await runBinary(
        ["scenario", "run", "--file", scenarioPath, "--mode", "scripted"],
        opengoatHome,
        env,
      ),
      "Scenario: scripted-smoke",
    );

    await expectOk(
      await runBinary(["agent", "delete", "developer"], opengoatHome, env),
      "Agent deleted: developer",
    );
    await expectOk(
      await runBinary(["agent", "list"], opengoatHome, env),
      "ceo",
    );

    const calls = await readStubCalls(stubLogPath);
    const flattened = calls.map((entry) => entry.join(" "));
    expect(
      flattened.some((entry) => entry.includes("agents add developer")),
    ).toBe(true);
    expect(
      flattened.some((entry) =>
        entry.includes("agents delete developer --force"),
      ),
    ).toBe(true);
    expect(flattened.some((entry) => entry.includes("gateway call agent"))).toBe(
      true,
    );
    expect(flattened.some((entry) => entry.includes('"agentId":"developer"'))).toBe(
      true,
    );
  });
});

async function expectOk(
  result: { code: number; stdout: string; stderr: string },
  stdoutSnippet: string,
): Promise<void> {
  expect(result.code).toBe(0);
  expect(result.stdout).toContain(stdoutSnippet);
}

async function writeSkillFixture(root: string): Promise<string> {
  const skillDir = path.join(root, "skill-helper");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    [
      "---",
      "name: Helper",
      "description: Helper skill for smoke tests.",
      "---",
      "",
      "# Helper",
      "",
      "- Use this skill in smoke tests.",
    ].join("\n"),
    "utf-8",
  );
  return skillDir;
}

async function writeScenarioFixture(root: string): Promise<string> {
  const scenarioPath = path.join(root, "scripted-scenario.json");
  await writeFile(
    scenarioPath,
    JSON.stringify(
      {
        name: "scripted-smoke",
        message: "Confirm scripted scenario execution.",
        entryAgentId: "ceo",
        scripted: {
          agentReplies: {
            ceo: "Scripted response from ceo.",
          },
        },
        assertions: {
          mustSucceed: true,
          stdoutIncludes: ["Scripted response from ceo"],
        },
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  return scenarioPath;
}

async function createOpenClawStub(
  root: string,
): Promise<{ stubPath: string; stubLogPath: string }> {
  const stubLogPath = path.join(root, "openclaw-stub.log");
  const stubPath = path.join(root, "openclaw-stub.mjs");
  const managedSkillsDir = path.join(root, "openclaw-managed-skills");

  await writeFile(
    stubPath,
    [
      "#!/usr/bin/env node",
      "import { appendFileSync } from 'node:fs';",
      "const logPath = process.env.OPENCLAW_STUB_LOG;",
      "if (!logPath) {",
      "  process.stderr.write('missing OPENCLAW_STUB_LOG\\n');",
      "  process.exit(2);",
      "}",
      "const args = process.argv.slice(2);",
      "const normalized = normalizeArgs(args);",
      "appendFileSync(logPath, `${JSON.stringify(args)}\\n`, 'utf-8');",
      `const managedSkillsDir = process.env.OPENCLAW_MANAGED_SKILLS_DIR || ${JSON.stringify(managedSkillsDir)};`,
      "if (normalized[0] === 'skills' && normalized[1] === 'list' && normalized.includes('--json')) { process.stdout.write(JSON.stringify({ workspaceDir: '/tmp/openclaw-workspace', managedSkillsDir, skills: [] }) + '\\n'); process.exit(0); }",
      "if (normalized[0] === 'agents' && normalized[1] === 'list' && normalized.includes('--json')) { process.stdout.write('[]\\n'); process.exit(0); }",
      "if (normalized[0] === 'providers' && normalized[1] === 'list') { process.stdout.write('openclaw\\tOpenClaw\\n'); process.exit(0); }",
      "if (normalized[0] === 'agents' && normalized[1] === 'provider' && normalized[2] === 'get') { process.stdout.write(`${normalized[3] || ''}\\topenclaw\\n`); process.exit(0); }",
      "if (normalized[0] === 'agents' && normalized[1] === 'provider' && normalized[2] === 'set') { process.stdout.write('provider-set-ok\\n'); process.exit(0); }",
      "if (normalized[0] === 'agents' && normalized[1] === 'add') { process.stdout.write('agent-created\\n'); process.exit(0); }",
      "if (normalized[0] === 'agents' && normalized[1] === 'delete') { process.stdout.write('agent-deleted\\n'); process.exit(0); }",
      "if (normalized[0] === 'gateway' && normalized[1] === 'call' && normalized[2] === 'agent') {",
      "  process.stdout.write(JSON.stringify({ runId: 'stub-run', status: 'ok', summary: 'completed', result: { payloads: [{ text: 'stub-agent-reply', mediaUrl: null }], meta: { agentMeta: { sessionId: 'stub-provider-session' } } } }) + '\\n');",
      "  process.exit(0);",
      "}",
      "if (normalized[0] === 'agent') { process.stdout.write('stub-agent-reply\\n'); process.exit(0); }",
      "process.stdout.write('openclaw-stub-ok\\n');",
      "function normalizeArgs(input) {",
      "  const normalized = [...input];",
      "  while (normalized.length > 0) {",
      "    if (normalized[0] === '--profile') { normalized.splice(0, 2); continue; }",
      "    if (normalized[0] === '--dev' || normalized[0] === '--no-color') { normalized.splice(0, 1); continue; }",
      "    break;",
      "  }",
      "  return normalized;",
      "}",
    ].join("\n"),
    "utf-8",
  );
  await chmod(stubPath, 0o755);

  return {
    stubPath,
    stubLogPath,
  };
}

async function readStubCalls(stubLogPath: string): Promise<string[][]> {
  const commandLog = await readFile(stubLogPath, "utf-8");
  return commandLog
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
}

async function runBinary(
  args: string[],
  opengoatHome: string,
  envOverrides: NodeJS.ProcessEnv = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
  );
  const binaryPath = path.join(projectRoot, "bin", "opengoat");

  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        OPENGOAT_HOME: opengoatHome,
        ...envOverrides,
      },
    });
    return {
      code: 0,
      stdout: stdout ?? "",
      stderr: stderr ?? "",
    };
  } catch (error) {
    const failed = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      code: typeof failed.code === "number" ? failed.code : 1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
    };
  }
}
