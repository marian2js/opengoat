import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

describe("onboard command e2e", () => {
  it("bootstraps a fresh home, assigns provider, and saves provider config", async () => {
    const root = await createTempDir("opengoat-onboard-e2e-");
    roots.push(root);

    const result = await runBinary(
      ["onboard", "--non-interactive", "--provider", "openai", "--openai-api-key", "sk-test"],
      root
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Onboarding complete.");
    expect(result.stdout).toContain("Provider: openai");

    const agentConfig = JSON.parse(await readFile(path.join(root, "agents", "orchestrator", "config.json"), "utf-8")) as {
      provider?: { id?: string };
    };
    expect(agentConfig.provider?.id).toBe("openai");

    const providerConfig = JSON.parse(await readFile(path.join(root, "providers", "openai", "config.json"), "utf-8")) as {
      providerId?: string;
      env?: Record<string, string>;
    };
    expect(providerConfig.providerId).toBe("openai");
    expect(providerConfig.env?.OPENAI_API_KEY).toBe("sk-test");
  });

  it("fails with a clear error when required provider settings are missing", async () => {
    const root = await createTempDir("opengoat-onboard-e2e-");
    roots.push(root);

    const result = await runBinary(["onboard", "--non-interactive", "--provider", "google"], root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Missing required provider settings for google: GEMINI_API_KEY");
    expect(result.stderr).toContain("Provide values with --env KEY=VALUE");
  });

  it("rejects external providers for orchestrator onboarding", async () => {
    const root = await createTempDir("opengoat-onboard-e2e-");
    roots.push(root);

    const result = await runBinary(
      ["onboard", "--non-interactive", "--agent", "orchestrator", "--provider", "codex"],
      root
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Provider "codex" is not supported for orchestrator onboarding.');
  });
});

async function runBinary(args: string[], opengoatHome: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const binaryPath = path.join(projectRoot, "bin", "opengoat");

  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        OPENGOAT_HOME: opengoatHome
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
