import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import path, { delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { createTempDir, removeTempDir } from "../helpers/temp-opengoat.js";

const execFileAsync = promisify(execFile);
const OPENCLAW_COMMAND =
  process.env.OPENCLAW_CMD?.trim() ||
  resolveCommandOnPath("openclaw", process.env.PATH ?? "") ||
  "openclaw";
const NPM_COMMAND =
  process.platform === "win32"
    ? resolveCommandOnPath("npm.cmd", process.env.PATH ?? "") || "npm.cmd"
    : resolveCommandOnPath("npm", process.env.PATH ?? "") || "npm";
const PNPM_COMMAND =
  process.platform === "win32"
    ? resolveCommandOnPath("pnpm.cmd", process.env.PATH ?? "") || "pnpm.cmd"
    : resolveCommandOnPath("pnpm", process.env.PATH ?? "") || "pnpm";
const LIVE_E2E_ENABLED = process.env.OPENGOAT_LIVE_OPENCLAW_E2E === "1";
const TEST_TIMEOUT_MS = 6 * 60_000;
const STARTUP_TIMEOUT_MS = 90_000;
const TOOL_READY_TIMEOUT_MS = 90_000;

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const roots: string[] = [];
const cleanups: Array<() => Promise<void>> = [];

const EXPECTED_OPENGOAT_TOOLS = [
  "opengoat_agent_list",
  "opengoat_agent_info",
  "opengoat_agent_direct_reportees",
  "opengoat_agent_all_reportees",
  "opengoat_agent_last_action",
  "opengoat_agent_create",
  "opengoat_agent_delete",
  "opengoat_agent_set_manager",
  "opengoat_task_create",
  "opengoat_task_list",
  "opengoat_task_list_latest",
  "opengoat_task_get",
  "opengoat_task_delete",
  "opengoat_task_update_status",
  "opengoat_task_add_blocker",
  "opengoat_task_add_artifact",
  "opengoat_task_add_worklog",
] as const;

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (!cleanup) {
      continue;
    }
    await cleanup();
  }

  while (roots.length > 0) {
    const root = roots.pop();
    if (!root) {
      continue;
    }
    await removeTempDir(root);
  }
});

describe.runIf(LIVE_E2E_ENABLED)("live tool registration e2e", () => {
  it(
    "case 1: npm global install + opengoat start registers tools and exposes them to goat",
    async () => {
      const runtime = await createLiveRuntime();
      await buildCli(runtime.env);

      const npmPrefix = path.join(runtime.root, "npm-prefix");
      await mkdir(npmPrefix, { recursive: true });

      await runCommand(
        NPM_COMMAND,
        [
          "i",
          "-g",
          "--prefix",
          npmPrefix,
          path.join(projectRoot, "packages", "cli"),
        ],
        {
          cwd: projectRoot,
          env: runtime.env,
        },
      );

      const npmPath = [path.join(npmPrefix, "bin"), runtime.env.PATH ?? ""]
        .filter((entry) => entry.length > 0)
        .join(delimiter);

      const opengoat = startProcess(
        "opengoat",
        [
          "start",
          "--host",
          "127.0.0.1",
          "--port",
          String(runtime.uiPort),
        ],
        {
          cwd: projectRoot,
          env: {
            ...runtime.env,
            OPENGOAT_HOME: runtime.opengoatHome,
            PATH: npmPath,
          },
        },
      );
      cleanups.push(() => opengoat.stop());
      await opengoat.waitFor("OpenGoat UI server is running", STARTUP_TIMEOUT_MS);

      const gateway = await startGateway(runtime);
      cleanups.push(() => gateway.stop());

      await assertCeoCanAccessOpenGoatTools(runtime);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "case 2: plugin install + opengoat start registers tools and exposes them to goat",
    async () => {
      const runtime = await createLiveRuntime();
      await buildCli(runtime.env);

      await runCommand(
        OPENCLAW_COMMAND,
        [
          "plugins",
          "install",
          "--link",
          projectRoot,
        ],
        {
          cwd: projectRoot,
          env: runtime.env,
        },
      );

      const pluginBinPath = path.join(
        projectRoot,
        "bin",
      );

      const opengoat = startProcess(
        "opengoat",
        [
          "start",
          "--host",
          "127.0.0.1",
          "--port",
          String(runtime.uiPort),
        ],
        {
          cwd: projectRoot,
          env: {
            ...runtime.env,
            OPENGOAT_HOME: runtime.opengoatHome,
            PATH: [pluginBinPath, runtime.env.PATH ?? ""]
              .filter((entry) => entry.length > 0)
              .join(delimiter),
          },
        },
      );
      cleanups.push(() => opengoat.stop());
      await opengoat.waitFor("OpenGoat UI server is running", STARTUP_TIMEOUT_MS);

      const gateway = await startGateway(runtime);
      cleanups.push(() => gateway.stop());

      await assertCeoCanAccessOpenGoatTools(runtime);
    },
    TEST_TIMEOUT_MS,
  );
});

interface LiveRuntime {
  root: string;
  opengoatHome: string;
  gatewayPort: number;
  uiPort: number;
  gatewayToken: string;
  env: NodeJS.ProcessEnv;
}

interface StartedProcess {
  stop: () => Promise<void>;
  output: () => string;
  waitFor: (pattern: string, timeoutMs: number) => Promise<void>;
}

async function createLiveRuntime(): Promise<LiveRuntime> {
  const root = await createTempDir("opengoat-live-tool-reg-");
  roots.push(root);

  const opengoatHome = path.join(root, "opengoat-home");
  const openclawStateDir = path.join(root, "openclaw-state");
  const openclawConfigPath = path.join(openclawStateDir, "openclaw.json");
  const runtimeBinDir = path.join(root, "bin");
  const gatewayPort = await reservePort();
  const uiPort = await reservePort();
  const gatewayToken = randomToken();

  await mkdir(opengoatHome, { recursive: true });
  await mkdir(openclawStateDir, { recursive: true });
  await mkdir(runtimeBinDir, { recursive: true });

  const cleanBasePath = removeCommandFromPath(process.env.PATH ?? "", "opengoat");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OPENCLAW_STATE_DIR: openclawStateDir,
    OPENCLAW_CONFIG_PATH: openclawConfigPath,
    OPENCLAW_CMD: OPENCLAW_COMMAND,
    OPENGOAT_OPENCLAW_CMD: OPENCLAW_COMMAND,
    OPENGOAT_HOME: opengoatHome,
    PATH: [runtimeBinDir, cleanBasePath].filter(Boolean).join(delimiter),
  };

  await runCommand(
    OPENCLAW_COMMAND,
    [
      "onboard",
      "--non-interactive",
      "--accept-risk",
      "--mode",
      "local",
      "--auth-choice",
      "skip",
      "--gateway-bind",
      "loopback",
      "--gateway-auth",
      "token",
      "--gateway-token",
      gatewayToken,
      "--gateway-port",
      String(gatewayPort),
      "--skip-channels",
      "--skip-skills",
      "--skip-health",
      "--skip-ui",
      "--no-install-daemon",
      "--workspace",
      path.join(root, "openclaw-workspace"),
    ],
    { cwd: projectRoot, env },
  );

  return {
    root,
    opengoatHome,
    gatewayPort,
    uiPort,
    gatewayToken,
    env,
  };
}

async function startGateway(runtime: LiveRuntime): Promise<StartedProcess> {
  const gateway = startProcess(
    OPENCLAW_COMMAND,
    ["gateway", "run"],
    {
      cwd: projectRoot,
      env: {
        ...runtime.env,
        OPENGOAT_HOME: runtime.opengoatHome,
      },
    },
  );

  await waitForPortOpen(runtime.gatewayPort, STARTUP_TIMEOUT_MS);
  await waitForGatewayRpcReady(runtime.env, STARTUP_TIMEOUT_MS);

  return gateway;
}

async function assertCeoCanAccessOpenGoatTools(runtime: LiveRuntime): Promise<void> {
  for (const toolName of EXPECTED_OPENGOAT_TOOLS) {
    await waitForToolAvailability(runtime, toolName, TOOL_READY_TIMEOUT_MS);
  }
}

async function waitForToolAvailability(
  runtime: LiveRuntime,
  toolName: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "";

  while (Date.now() < deadline) {
    try {
      const response = await invokeGatewayTool(runtime, {
        tool: toolName,
        args: {},
        sessionKey: "agent:goat:main",
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Gateway auth failed while checking ${toolName}: ${response.raw}`);
      }

      if (response.status === 404 && response.message.includes("Tool not available")) {
        lastFailure = `Tool is unavailable to goat: ${toolName}. Response: ${response.raw}`;
        await wait(1000);
        continue;
      }

      if (isRuntimeBootstrapError(response.toolError)) {
        lastFailure = `Tool failed to initialize OpenGoat runtime (${toolName}): ${response.toolError}`;
        await wait(1000);
        continue;
      }

      return;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
      await wait(1000);
    }
  }

  throw new Error(
    `Timed out waiting for tool availability (${toolName}): ${lastFailure}`,
  );
}

async function invokeGatewayTool(
  runtime: LiveRuntime,
  request: {
    tool: string;
    args: Record<string, unknown>;
    sessionKey: string;
  },
): Promise<{ status: number; message: string; toolError: string; raw: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      `http://127.0.0.1:${runtime.gatewayPort}/tools/invoke`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${runtime.gatewayToken}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      },
    );

    const raw = await response.text();
    const parsed = parseLooseJson(raw);
    const message = extractErrorMessage(parsed);
    const toolError = extractToolErrorMessage(parsed);

    return {
      status: response.status,
      message,
      toolError,
      raw,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractErrorMessage(payload: unknown): string {
  const record = asRecord(payload);
  const error = asRecord(record.error);
  if (typeof error.message === "string") {
    return error.message;
  }
  return "";
}

function extractToolErrorMessage(payload: unknown): string {
  const record = asRecord(payload);
  const result = asRecord(record.result);
  const details = asRecord(result.details);
  if (typeof details.error === "string") {
    return details.error;
  }
  return "";
}

function isRuntimeBootstrapError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("createopengoatruntime is not a function") ||
    normalized.includes("unable to load opengoat core runtime") ||
    normalized.includes("cannot find module 'sql.js'") ||
    normalized.includes("cannot find module \"sql.js\"")
  );
}

function startProcess(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): StartedProcess {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;

  let output = "";
  let spawnError: Error | undefined;
  child.stdout.on("data", (chunk: Buffer | string) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer | string) => {
    output += chunk.toString();
  });
  child.on("error", (error) => {
    spawnError = error instanceof Error ? error : new Error(String(error));
  });

  return {
    output: () => output,
    waitFor: async (pattern, timeoutMs) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (spawnError) {
          throw new Error(
            [
              `Process failed before pattern appeared: ${pattern}`,
              `Command: ${command} ${args.join(" ")}`,
              `Error: ${spawnError.message}`,
              "Output:",
              output.trim(),
            ].join("\n"),
          );
        }
        if (output.includes(pattern)) {
          return;
        }
        const exitCode = child.exitCode;
        if (exitCode !== null) {
          throw new Error(
            [
              `Process exited before pattern appeared: ${pattern}`,
              `Command: ${command} ${args.join(" ")}`,
              `Exit code: ${exitCode}`,
              "Output:",
              output.trim(),
            ].join("\n"),
          );
        }
        await wait(200);
      }

      throw new Error(
        [
          `Timed out waiting for pattern: ${pattern}`,
          `Command: ${command} ${args.join(" ")}`,
          "Output:",
          output.trim(),
        ].join("\n"),
      );
    },
    stop: async () => {
      if (spawnError) {
        return;
      }
      if (child.exitCode !== null) {
        return;
      }
      child.kill("SIGTERM");
      const stopped = await waitForExit(child, 5000);
      if (!stopped && child.exitCode === null) {
        child.kill("SIGKILL");
        await waitForExit(child, 5000);
      }
    },
  };
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeoutMs,
      maxBuffer: 1024 * 1024 * 8,
    });
    return {
      stdout: stdout ?? "",
      stderr: stderr ?? "",
    };
  } catch (error) {
    const failure = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        `Exit code: ${failure.code ?? "unknown"}`,
        `Message: ${failure.message ?? ""}`,
        "Stdout:",
        (failure.stdout ?? "").trim(),
        "Stderr:",
        (failure.stderr ?? "").trim(),
      ].join("\n"),
    );
  }
}

async function reservePort(): Promise<number> {
  const server = net.createServer();

  return await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to reserve port."));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForExit(
  process: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<boolean> {
  if (process.exitCode !== null) {
    return true;
  }

  return await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      process.off("exit", onExit);
      resolve(false);
    }, timeoutMs);

    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };

    process.once("exit", onExit);
  });
}

function parseLooseJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Continue.
  }

  const candidates = [trimmed.indexOf("{"), trimmed.indexOf("[")].filter(
    (index) => index >= 0,
  );

  for (const startIndex of candidates) {
    const candidate = trimmed.slice(startIndex).trim();
    if (!candidate) {
      continue;
    }
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next candidate.
    }
  }

  return {};
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPortOpen(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await probePort(port);
    if (open) {
      return;
    }
    await wait(200);
  }
  throw new Error(`Timed out waiting for gateway port ${port} to open.`);
}

async function probePort(port: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    socket.once("error", onError);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
  });
}

async function waitForGatewayRpcReady(
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await runCommand(
        OPENCLAW_COMMAND,
        ["gateway", "call", "status", "--json"],
        { cwd: projectRoot, env, timeoutMs: 5_000 },
      );
      return;
    } catch (error) {
      lastError = error;
      await wait(500);
    }
  }

  throw new Error(
    `Timed out waiting for gateway RPC readiness: ${String(lastError)}`,
  );
}

function removeCommandFromPath(pathValue: string, command: string): string {
  const entries = pathValue
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const commandNames =
    process.platform === "win32"
      ? [command, `${command}.cmd`, `${command}.exe`, `${command}.bat`]
      : [command];

  const filtered = entries.filter((entry) => {
    return !commandNames.some((name) => existsSync(path.join(entry, name)));
  });

  return filtered.join(delimiter);
}

function resolveCommandOnPath(command: string, pathValue: string): string | undefined {
  const entries = pathValue
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  for (const entry of entries) {
    const candidate = path.join(entry, command);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function randomToken(): string {
  return `tok-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

async function buildCli(env: NodeJS.ProcessEnv): Promise<void> {
  await runCommand(
    PNPM_COMMAND,
    ["--filter", "opengoat", "build"],
    {
      cwd: projectRoot,
      env,
      timeoutMs: 180_000,
    },
  );
}
