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
  it(
    "bootstraps a fresh home and saves local OpenClaw runtime config",
    async () => {
    const root = await createTempDir("opengoat-onboard-e2e-");
    roots.push(root);

    const result = await runBinary(["onboard", "--non-interactive"], root);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Mode: local");
    expect(result.stdout).toContain("Saved runtime config:");

    const providerConfig = JSON.parse(
      await readFile(path.join(root, "providers", "openclaw", "config.json"), "utf-8")
    ) as {
      providerId?: string;
      env?: Record<string, string>;
    };
    expect(providerConfig.providerId).toBe("openclaw");
    expect(providerConfig.env?.OPENGOAT_OPENCLAW_GATEWAY_MODE).toBe("local");
    },
    45_000,
  );

  it("saves external OpenClaw gateway settings", async () => {
    const root = await createTempDir("opengoat-onboard-e2e-");
    roots.push(root);

    const result = await runBinary(
      [
        "onboard",
        "--non-interactive",
        "--external",
        "--gateway-url",
        "ws://remote-host:18789",
        "--gateway-token",
        "secret-token"
      ],
      root
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Mode: external");
    expect(result.stdout).toContain("Gateway URL: ws://remote-host:18789");

    const providerConfig = JSON.parse(
      await readFile(path.join(root, "providers", "openclaw", "config.json"), "utf-8")
    ) as {
      env?: Record<string, string>;
    };
    expect(providerConfig.env?.OPENGOAT_OPENCLAW_GATEWAY_MODE).toBe("external");
    expect(providerConfig.env?.OPENCLAW_GATEWAY_URL).toBe("ws://remote-host:18789");
    expect(providerConfig.env?.OPENCLAW_GATEWAY_PASSWORD).toBe("secret-token");
    expect(providerConfig.env?.OPENCLAW_ARGUMENTS).toContain("--remote ws://remote-host:18789");
  }, 45_000);

  it("fails with a clear error when external mode is missing required fields", async () => {
    const root = await createTempDir("opengoat-onboard-e2e-");
    roots.push(root);

    const result = await runBinary(["onboard", "--non-interactive", "--external"], root);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("External mode requires --gateway-url and --gateway-token.");
  });

  it("rejects gateway url/token flags in local mode", async () => {
    const root = await createTempDir("opengoat-onboard-e2e-");
    roots.push(root);

    const result = await runBinary(
      ["onboard", "--non-interactive", "--local", "--gateway-url", "ws://remote-host:18789"],
      root
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("--gateway-url/--gateway-token are only valid with --external.");
  });
});

async function runBinary(args: string[], opengoatHome: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const binaryPath = path.join(projectRoot, "bin", "opengoat");
  const openClawStateDir = path.join(opengoatHome, ".openclaw");

  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        OPENGOAT_HOME: opengoatHome,
        OPENCLAW_STATE_DIR: openClawStateDir,
        OPENCLAW_CONFIG_PATH: path.join(openClawStateDir, "openclaw.json")
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
