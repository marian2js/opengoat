import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { access, chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

describe("agent create OpenClaw sync e2e", () => {
  it("uses normalized id for multi-word names when creating in OpenClaw", async () => {
    const root = await createTempDir("opengoat-agent-create-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    await mkdir(opengoatHome, { recursive: true });
    const { stubPath, stubLogPath } = await createOpenClawStub(root);

    const result = await runBinary(
      ["agent", "create", "John Doe"],
      opengoatHome,
      {
        OPENCLAW_CMD: stubPath,
        OPENCLAW_STUB_LOG: stubLogPath
      }
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Agent ready: John Doe (john-doe)");

    const calls = await readStubCalls(stubLogPath);
    const addCall = findCommandCall(calls, "agents", "add");
    expect(addCall).toBeDefined();
    expect(addCall).toEqual(
      expect.arrayContaining([
        "agents",
        "add",
        "john-doe",
        "--workspace",
        path.join(opengoatHome, "workspaces", "john-doe"),
        "--agent-dir",
        path.join(opengoatHome, "agents", "john-doe"),
        "--non-interactive"
      ])
    );
  });

  it("creates an agent and syncs it to OpenClaw", async () => {
    const root = await createTempDir("opengoat-agent-create-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    await mkdir(opengoatHome, { recursive: true });
    const { stubPath, stubLogPath } = await createOpenClawStub(root);

    const result = await runBinary(
      ["agent", "create", "OpenClaw Writer", "--specialist", "--reports-to", "goat", "--skill", "writing"],
      opengoatHome,
      {
        OPENCLAW_CMD: stubPath,
        OPENCLAW_STUB_LOG: stubLogPath
      }
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Agent ready: OpenClaw Writer (openclaw-writer)");
    expect(result.stdout).toContain("OpenClaw sync: openclaw (code 0)");

    const calls = await readStubCalls(stubLogPath);
    const addCall = findCommandCall(calls, "agents", "add");
    expect(addCall).toBeDefined();
    expect(addCall).toEqual(
      expect.arrayContaining([
        "agents",
        "add",
        "openclaw-writer",
        "--workspace",
        path.join(opengoatHome, "workspaces", "openclaw-writer"),
        "--agent-dir",
        path.join(opengoatHome, "agents", "openclaw-writer"),
        "--non-interactive"
      ])
    );
  });

  it("prepends OPENCLAW_ARGUMENTS before create subcommand", async () => {
    const root = await createTempDir("opengoat-agent-create-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    await mkdir(opengoatHome, { recursive: true });
    const { stubPath, stubLogPath } = await createOpenClawStub(root);

    const result = await runBinary(
      ["agent", "create", "Profile Targeted Agent"],
      opengoatHome,
      {
        OPENCLAW_CMD: stubPath,
        OPENCLAW_STUB_LOG: stubLogPath,
        OPENCLAW_ARGUMENTS: "--profile team-a"
      }
    );

    expect(result.code).toBe(0);
    const calls = await readStubCalls(stubLogPath);
    const addCallRaw = calls.find((entry) => entry[0] === "--profile");
    expect(addCallRaw?.slice(0, 2)).toEqual(["--profile", "team-a"]);
    const addCall = findCommandCall(calls, "agents", "add");
    expect(addCall?.slice(0, 3)).toEqual([
      "agents",
      "add",
      "profile-targeted-agent",
    ]);
  });

  it("deletes an agent and syncs deletion to OpenClaw", async () => {
    const root = await createTempDir("opengoat-agent-create-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    await mkdir(opengoatHome, { recursive: true });
    const { stubPath, stubLogPath } = await createOpenClawStub(root);

    const createResult = await runBinary(
      ["agent", "create", "Temporary Agent"],
      opengoatHome,
      {
        OPENCLAW_CMD: stubPath,
        OPENCLAW_STUB_LOG: stubLogPath
      }
    );
    expect(createResult.code).toBe(0);

    const deleteResult = await runBinary(
      ["agent", "delete", "temporary-agent"],
      opengoatHome,
      {
        OPENCLAW_CMD: stubPath,
        OPENCLAW_STUB_LOG: stubLogPath
      }
    );

    expect(deleteResult.code).toBe(0);
    expect(deleteResult.stdout).toContain("Agent deleted: temporary-agent");
    expect(deleteResult.stdout).toContain("OpenClaw sync: openclaw (code 0)");

    const calls = await readStubCalls(stubLogPath);
    const deleteCall = findCommandCall(calls, "agents", "delete");
    expect(deleteCall).toBeDefined();
    expect(deleteCall).toEqual(
      expect.arrayContaining(["agents", "delete", "temporary-agent", "--force"])
    );
  });

  it("reports an error when OpenClaw create sync fails", async () => {
    const root = await createTempDir("opengoat-agent-create-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    await mkdir(opengoatHome, { recursive: true });
    const { stubPath, stubLogPath } = await createOpenClawStub(root, { failOnAdd: true });

    const result = await runBinary(
      ["agent", "create", "Failing Agent"],
      opengoatHome,
      {
        OPENCLAW_CMD: stubPath,
        OPENCLAW_STUB_LOG: stubLogPath
      }
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("OpenClaw agent creation failed");
    const calls = await readStubCalls(stubLogPath);
    expect(findCommandCall(calls, "agents", "add")).toBeDefined();
  });

  it("still calls OpenClaw create when the local agent already exists", async () => {
    const root = await createTempDir("opengoat-agent-create-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    await mkdir(opengoatHome, { recursive: true });
    const first = await createOpenClawStub(root, { logName: "openclaw-stub-first.log" });
    const second = await createOpenClawStub(root, { logName: "openclaw-stub-second.log" });

    const createFirst = await runBinary(
      ["agent", "create", "Repeatable Agent"],
      opengoatHome,
      {
        OPENCLAW_CMD: first.stubPath,
        OPENCLAW_STUB_LOG: first.stubLogPath
      }
    );
    expect(createFirst.code).toBe(0);

    const createSecond = await runBinary(
      ["agent", "create", "Repeatable Agent"],
      opengoatHome,
      {
        OPENCLAW_CMD: second.stubPath,
        OPENCLAW_STUB_LOG: second.stubLogPath
      }
    );

    expect(createSecond.code).toBe(0);
    expect(createSecond.stdout).toContain("Local agent already existed; OpenClaw sync was still attempted.");
    const calls = await readStubCalls(second.stubLogPath);
    const addCall = findCommandCall(calls, "agents", "add");
    expect(addCall).toBeDefined();
    expect(addCall).toEqual(
      expect.arrayContaining([
        "agents",
        "add",
        "repeatable-agent",
        "--workspace",
        path.join(opengoatHome, "workspaces", "repeatable-agent"),
        "--agent-dir",
        path.join(opengoatHome, "agents", "repeatable-agent"),
        "--non-interactive"
      ])
    );
  });

  it("does not recreate goat BOOTSTRAP.md when goat create is re-run", async () => {
    const root = await createTempDir("opengoat-agent-create-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    await mkdir(opengoatHome, { recursive: true });
    const { stubPath, stubLogPath } = await createOpenClawStub(root);

    const initResult = await runBinary(
      ["init"],
      opengoatHome,
      {
        OPENCLAW_CMD: stubPath,
        OPENCLAW_STUB_LOG: stubLogPath,
      },
    );
    expect(initResult.code).toBe(0);

    const bootstrapPath = path.join(opengoatHome, "workspaces", "goat", "BOOTSTRAP.md");
    await expect(access(bootstrapPath, constants.F_OK)).resolves.toBeUndefined();
    await rm(bootstrapPath);
    await expect(access(bootstrapPath, constants.F_OK)).rejects.toBeTruthy();

    const recreateCeo = await runBinary(
      ["agent", "create", "Goat"],
      opengoatHome,
      {
        OPENCLAW_CMD: stubPath,
        OPENCLAW_STUB_LOG: stubLogPath,
      },
    );
    expect(recreateCeo.code).toBe(0);
    expect(recreateCeo.stdout).toContain(
      "Local agent already existed; OpenClaw sync was still attempted.",
    );
    await expect(access(bootstrapPath, constants.F_OK)).rejects.toBeTruthy();
  });
});

async function createOpenClawStub(
  root: string,
  options: { failOnAdd?: boolean; logName?: string } = {}
): Promise<{ stubPath: string; stubLogPath: string }> {
  const failOnAdd = options.failOnAdd ?? false;
  const logName = options.logName ?? "openclaw-stub.log";
  const safeSuffix = logName.replace(/[^a-z0-9.-]/gi, "-");
  const stubLogPath = path.join(root, safeSuffix);
  const stubPath = path.join(root, `${safeSuffix}.mjs`);
  const managedSkillsDir = path.join(root, `${safeSuffix}-managed-skills`);

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
      "if (normalized[0] === 'skills' && normalized[1] === 'list' && normalized.includes('--json')) {",
      "  process.stdout.write(JSON.stringify({ workspaceDir: '/tmp/openclaw-workspace', managedSkillsDir, skills: [] }) + '\\n');",
      "  process.exit(0);",
      "}",
      "if (normalized[0] === 'agents' && normalized[1] === 'list' && normalized.includes('--json')) {",
      "  process.stdout.write('[]\\n');",
      "  process.exit(0);",
      "}",
      failOnAdd
        ? "if (normalized[0] === 'agents' && normalized[1] === 'add') { process.stderr.write('stub create failure\\n'); process.exit(1); }"
        : "",
      "process.stdout.write('openclaw-stub-ok\\n');",
      "function normalizeArgs(input) {",
      "  const normalized = [...input];",
      "  while (normalized.length > 0) {",
      "    if (normalized[0] === '--profile') { normalized.splice(0, 2); continue; }",
      "    if (normalized[0] === '--dev' || normalized[0] === '--no-color') { normalized.splice(0, 1); continue; }",
      "    break;",
      "  }",
      "  return normalized;",
      "}"
    ].filter(Boolean).join("\n"),
    "utf-8"
  );
  await chmod(stubPath, 0o755);

  return {
    stubPath,
    stubLogPath
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

function findCommandCall(calls: string[][], command: string, subcommand: string): string[] | undefined {
  return calls
    .map((entry) => normalizeCommandArgs(entry))
    .find((entry) => entry[0] === command && entry[1] === subcommand);
}

function normalizeCommandArgs(args: string[]): string[] {
  const normalized = [...args];
  while (normalized.length > 0) {
    if (normalized[0] === "--profile") {
      normalized.splice(0, 2);
      continue;
    }
    if (normalized[0] === "--dev" || normalized[0] === "--no-color") {
      normalized.splice(0, 1);
      continue;
    }
    break;
  }
  return normalized;
}

async function runBinary(
  args: string[],
  opengoatHome: string,
  envOverrides: NodeJS.ProcessEnv = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const binaryPath = path.join(projectRoot, "bin", "opengoat");

  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        OPENGOAT_HOME: opengoatHome,
        ...envOverrides
      }
    });
    return {
      code: 0,
      stdout: stdout ?? "",
      stderr: stderr ?? ""
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
      stderr: failed.stderr ?? ""
    };
  }
}
