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

describe("agent create external provider e2e", () => {
  it("creates provider-side Claude agent definitions", async () => {
    const root = await createTempDir("opengoat-agent-create-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    const providerHome = path.join(root, "provider-home");
    await mkdir(opengoatHome, { recursive: true });
    await mkdir(providerHome, { recursive: true });

    const result = await runBinary(
      ["agent", "create", "Claude Writer", "--provider", "claude"],
      opengoatHome,
      {
        HOME: providerHome
      }
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("External agent creation (claude): code 0");

    const createdAgentPath = path.join(providerHome, ".claude", "agents", "claude-writer.md");
    const contents = await readFile(createdAgentPath, "utf-8");
    expect(contents).toContain('name: "claude-writer"');
    expect(contents).toContain("You are Claude Writer");
  });

  it("creates provider-side OpenCode agent definitions", async () => {
    const root = await createTempDir("opengoat-agent-create-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    const opencodeConfigDir = path.join(root, "opencode-config");
    await mkdir(opengoatHome, { recursive: true });
    await mkdir(opencodeConfigDir, { recursive: true });

    const result = await runBinary(
      ["agent", "create", "OpenCode Writer", "--provider", "opencode"],
      opengoatHome,
      {
        OPENCODE_CONFIG_DIR: opencodeConfigDir
      }
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("External agent creation (opencode): code 0");

    const createdAgentPath = path.join(opencodeConfigDir, "agent", "opencode-writer.md");
    const contents = await readFile(createdAgentPath, "utf-8");
    expect(contents).toContain("mode: subagent");
    expect(contents).toContain("You are OpenCode Writer");
  });

  it("creates provider-side OpenClaw agents via provider command", async () => {
    const root = await createTempDir("opengoat-agent-create-e2e-");
    roots.push(root);

    const opengoatHome = path.join(root, "opengoat-home");
    const stubLogPath = path.join(root, "openclaw-stub.log");
    const stubPath = path.join(root, "openclaw-stub.mjs");
    await mkdir(opengoatHome, { recursive: true });

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
        "appendFileSync(logPath, `${JSON.stringify(process.argv.slice(2))}\\n`, 'utf-8');",
        "process.stdout.write('openclaw-stub-ok\\n');"
      ].join("\n"),
      "utf-8"
    );
    await chmod(stubPath, 0o755);

    const result = await runBinary(
      ["agent", "create", "OpenClaw Writer", "--provider", "openclaw"],
      opengoatHome,
      {
        OPENCLAW_CMD: stubPath,
        OPENCLAW_STUB_LOG: stubLogPath
      }
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("External agent creation (openclaw): code 0");

    const commandLog = await readFile(stubLogPath, "utf-8");
    const calls = commandLog
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(
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
});

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
